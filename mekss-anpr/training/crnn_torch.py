"""PyTorch rebuild of the Platrix CRNN (BatchNorm folded into conv) with ONNX weight import/export.

``python training/crnn_torch.py models/ocr_crnn.onnx`` checks the rebuild against onnxruntime.
"""

from __future__ import annotations

import numpy as np
import onnx
import torch
from onnx import numpy_helper
from torch import nn

CONV_KEYS = [
    ("onnx::Conv_376", "onnx::Conv_377"),
    ("onnx::Conv_379", "onnx::Conv_380"),
    ("onnx::Conv_382", "onnx::Conv_383"),
    ("onnx::Conv_385", "onnx::Conv_386"),
    ("onnx::Conv_388", "onnx::Conv_389"),
    ("onnx::Conv_391", "onnx::Conv_392"),
]
LSTM_KEYS = [("onnx::LSTM_436", "onnx::LSTM_437", "onnx::LSTM_435"), ("onnx::LSTM_479", "onnx::LSTM_480", "onnx::LSTM_478")]
# ONNX gate order i,o,f,c  ->  PyTorch i,f,g,o
GATE_PERM = [0, 2, 3, 1]


class Crnn(nn.Module):
    def __init__(self, num_classes: int = 33) -> None:
        super().__init__()
        self.c0 = nn.Conv2d(1, 64, 3, padding=1)
        self.c1 = nn.Conv2d(64, 128, 3, padding=1)
        self.c2 = nn.Conv2d(128, 256, 3, padding=1)
        self.c3 = nn.Conv2d(256, 256, 3, padding=1)
        self.c4 = nn.Conv2d(256, 256, 3, padding=1)
        self.c5 = nn.Conv2d(256, 256, 2)
        self.rnn = nn.LSTM(256, 128, num_layers=2, bidirectional=True)
        self.fc = nn.Linear(256, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        r = torch.relu
        x = nn.functional.max_pool2d(r(self.c0(x)), 2)
        x = nn.functional.max_pool2d(r(self.c1(x)), 2)
        x = r(self.c2(x))
        x = nn.functional.max_pool2d(r(self.c3(x)), (2, 1))
        x = nn.functional.max_pool2d(r(self.c4(x)), (2, 1))
        x = r(self.c5(x))  # B x 256 x 1 x T
        x = x.squeeze(2).permute(2, 0, 1)  # T x B x 256
        x, _ = self.rnn(x)
        return self.fc(x).permute(1, 0, 2)  # B x T x C


def _reorder(w: np.ndarray, hidden: int) -> np.ndarray:
    chunks = [w[i * hidden : (i + 1) * hidden] for i in range(4)]
    return np.concatenate([chunks[i] for i in GATE_PERM], axis=0)


def load_onnx_weights(model: Crnn, path: str) -> Crnn:
    """Load weights from the original Platrix export (initializer names are export-specific)."""
    init = {t.name: numpy_helper.to_array(t) for t in onnx.load(path).graph.initializer}
    if "onnx::Conv_376" not in init:
        raise ValueError(f"{path} is not the Platrix export; load a .pt state dict instead")
    convs = [model.c0, model.c1, model.c2, model.c3, model.c4, model.c5]
    with torch.no_grad():
        for conv, (wk, bk) in zip(convs, CONV_KEYS):
            conv.weight.copy_(torch.from_numpy(init[wk]))
            conv.bias.copy_(torch.from_numpy(init[bk]))
        hidden = 128
        for layer, (wk, rk, bk) in enumerate(LSTM_KEYS):
            W, R, B = init[wk], init[rk], init[bk]
            for d, suffix in enumerate(["", "_reverse"]):
                getattr(model.rnn, f"weight_ih_l{layer}{suffix}").copy_(torch.from_numpy(_reorder(W[d], hidden)))
                getattr(model.rnn, f"weight_hh_l{layer}{suffix}").copy_(torch.from_numpy(_reorder(R[d], hidden)))
                getattr(model.rnn, f"bias_ih_l{layer}{suffix}").copy_(torch.from_numpy(_reorder(B[d][: 4 * hidden], hidden)))
                getattr(model.rnn, f"bias_hh_l{layer}{suffix}").copy_(torch.from_numpy(_reorder(B[d][4 * hidden :], hidden)))
        model.fc.weight.copy_(torch.from_numpy(init["onnx::MatMul_481"].T.copy()))
        model.fc.bias.copy_(torch.from_numpy(init["fc.bias"]))
    return model


def export_onnx(model: Crnn, path: str) -> None:
    """Same I/O contract as the original: ``input`` [B,1,32,128] -> ``logits`` [B,31,33]."""
    model.eval()
    torch.onnx.export(
        model,
        torch.zeros(1, 1, 32, 128),
        path,
        input_names=["input"],
        output_names=["logits"],
        dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=13,
        dynamo=False,
    )


if __name__ == "__main__":
    import sys

    import onnxruntime as ort

    src = sys.argv[1]
    m = load_onnx_weights(Crnn(), src).eval()
    x = torch.rand(4, 1, 32, 128)
    with torch.no_grad():
        y = m(x).numpy()
    ref = ort.InferenceSession(src, providers=["CPUExecutionProvider"]).run(None, {"input": x.numpy()})[0]
    print("max abs diff vs onnxruntime:", float(np.abs(ref - y).max()))
