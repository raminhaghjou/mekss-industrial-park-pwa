import apiClient from './base.api';

export const feedbackApi = {
  submit: (data) => apiClient.post('/feedback', data),
};
