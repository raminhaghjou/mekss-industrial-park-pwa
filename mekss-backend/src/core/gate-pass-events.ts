import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export type GatePassChange = { gatePassId: string; factoryId: string; kind: 'created' | 'updated' | 'decided' };

/** In-process fan-out of gate-pass mutations (e.g. to invalidate the ANPR open-plate cache). */
@Injectable()
export class GatePassEvents {
  private readonly subject = new Subject<GatePassChange>();

  get changes$(): Observable<GatePassChange> {
    return this.subject.asObservable();
  }

  emit(change: GatePassChange): void {
    this.subject.next(change);
  }
}
