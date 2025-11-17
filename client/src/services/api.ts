import axios, { AxiosInstance } from 'axios';

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      timeout: 30000,
    });

    // Add auth token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(username: string, password: string) {
    const response = await this.client.post('/auth/login', { username, password });
    return response.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.client.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  }

  // Cameras
  async getCameras() {
    const response = await this.client.get('/cameras');
    return response.data;
  }

  async getCamera(id: string) {
    const response = await this.client.get(`/cameras/${id}`);
    return response.data;
  }

  async createCamera(camera: any) {
    const response = await this.client.post('/cameras', camera);
    return response.data;
  }

  async updateCamera(id: string, camera: any) {
    const response = await this.client.put(`/cameras/${id}`, camera);
    return response.data;
  }

  async deleteCamera(id: string) {
    const response = await this.client.delete(`/cameras/${id}`);
    return response.data;
  }

  async getCameraSnapshot(id: string) {
    return `/api/cameras/${id}/snapshot?${Date.now()}`;
  }

  // Recordings
  async getRecordings(params?: any) {
    const response = await this.client.get('/recordings', { params });
    return response.data;
  }

  async getRecording(id: string) {
    const response = await this.client.get(`/recordings/${id}`);
    return response.data;
  }

  async deleteRecording(id: string) {
    const response = await this.client.delete(`/recordings/${id}`);
    return response.data;
  }

  getRecordingVideoUrl(id: string) {
    return `/api/recordings/${id}/video`;
  }

  getRecordingThumbnailUrl(id: string) {
    return `/api/recordings/${id}/thumbnail`;
  }

  async getRecordingsTimeline(cameraId: string, startDate: Date, endDate: Date) {
    const response = await this.client.get(`/recordings/camera/${cameraId}/timeline`, {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
    return response.data;
  }

  // AI Detections
  async getDetections(params?: any) {
    const response = await this.client.get('/detections', { params });
    return response.data;
  }

  getDetectionSnapshotUrl(id: string) {
    return `/api/detections/${id}/snapshot`;
  }

  async getLicensePlates(params?: any) {
    const response = await this.client.get('/detections/license-plates', { params });
    return response.data;
  }

  async searchLicensePlates(query: string) {
    const response = await this.client.get('/detections/license-plates/search', {
      params: { query },
    });
    return response.data;
  }

  // Alarms
  async getAlarms() {
    const response = await this.client.get('/alarms');
    return response.data;
  }

  async createAlarm(alarm: any) {
    const response = await this.client.post('/alarms', alarm);
    return response.data;
  }

  async updateAlarm(id: string, alarm: any) {
    const response = await this.client.put(`/alarms/${id}`, alarm);
    return response.data;
  }

  async deleteAlarm(id: string) {
    const response = await this.client.delete(`/alarms/${id}`);
    return response.data;
  }

  async testAlarm(id: string) {
    const response = await this.client.post(`/alarms/${id}/test`);
    return response.data;
  }

  async getAlarmEvents(params?: any) {
    const response = await this.client.get('/alarms/events', { params });
    return response.data;
  }

  async acknowledgeAlarmEvent(id: string) {
    const response = await this.client.post(`/alarms/events/${id}/acknowledge`);
    return response.data;
  }

  // System
  async getSystemStats() {
    const response = await this.client.get('/system/stats');
    return response.data;
  }

  async getSystemSettings() {
    const response = await this.client.get('/system/settings');
    return response.data;
  }

  async updateSystemSettings(settings: any) {
    const response = await this.client.put('/system/settings', settings);
    return response.data;
  }

  async sendTestEmail(email: string) {
    const response = await this.client.post('/system/test-email', { email });
    return response.data;
  }

  async getStorageStats() {
    const response = await this.client.get('/system/storage');
    return response.data;
  }

  async performStorageCleanup() {
    const response = await this.client.post('/system/storage/cleanup');
    return response.data;
  }

  async getSystemLogs() {
    const response = await this.client.get('/system/logs');
    return response.data;
  }

  // Streaming
  getHLSUrl(cameraId: string) {
    return `/stream/hls/${cameraId}/playlist.m3u8`;
  }
}

export const api = new APIClient();
export default api;
