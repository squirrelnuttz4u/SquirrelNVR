import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  Grid,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  IconButton,
  Chip,
  Alert,
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Videocam as VideocamIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface Camera {
  id: string;
  name: string;
  streamUrl: string;
  streamType: string;
  username?: string;
  password?: string;
  enabled: boolean;
  recordingMode: string;
  manufacturer?: string;
  model?: string;
  aiEnabled: boolean;
  supportsPTZ: boolean;
  audioEnabled: boolean;
  motionSensitivity: number;
}

interface VendorPreset {
  vendor: string;
  model?: string;
  streamType: string;
  defaultPort: number;
  streamPath: string;
  subStreamPath?: string;
  requiresAuth: boolean;
  supportsOnvif: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Cameras: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [vendorPresets, setVendorPresets] = useState<VendorPreset[]>([]);
  const [error, setError] = useState<string>('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    streamUrl: '',
    streamType: 'rtsp',
    username: '',
    password: '',
    enabled: true,
    recordingMode: 'continuous',
    vendor: '',
    model: '',
    ipAddress: '',
    port: '554',
    aiEnabled: true,
    supportsPTZ: false,
    ptzType: '',
    audioEnabled: true,
    audioCodec: 'aac',
    twoWayAudio: false,
    motionSensitivity: 50,
    filteredDetectionClasses: [] as string[],
  });

  useEffect(() => {
    loadCameras();
    loadVendorPresets();
  }, []);

  const loadCameras = async () => {
    try {
      const data = await api.getCameras();
      setCameras(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load cameras');
    } finally {
      setLoading(false);
    }
  };

  const loadVendorPresets = async () => {
    // Hardcoded vendor presets
    const presets: VendorPreset[] = [
      {
        vendor: 'Reolink',
        streamType: 'rtsp',
        defaultPort: 554,
        streamPath: '/h264Preview_01_main',
        subStreamPath: '/h264Preview_01_sub',
        requiresAuth: true,
        supportsOnvif: true,
      },
      {
        vendor: 'Hikvision',
        streamType: 'rtsp',
        defaultPort: 554,
        streamPath: '/Streaming/Channels/101',
        subStreamPath: '/Streaming/Channels/102',
        requiresAuth: true,
        supportsOnvif: true,
      },
      {
        vendor: 'Dahua',
        streamType: 'rtsp',
        defaultPort: 554,
        streamPath: '/cam/realmonitor?channel=1&subtype=0',
        subStreamPath: '/cam/realmonitor?channel=1&subtype=1',
        requiresAuth: true,
        supportsOnvif: true,
      },
      {
        vendor: 'Amcrest',
        streamType: 'rtsp',
        defaultPort: 554,
        streamPath: '/cam/realmonitor?channel=1&subtype=0',
        requiresAuth: true,
        supportsOnvif: true,
      },
      {
        vendor: 'Axis',
        streamType: 'rtsp',
        defaultPort: 554,
        streamPath: '/axis-media/media.amp',
        subStreamPath: '/axis-media/media.amp?resolution=640x480',
        requiresAuth: true,
        supportsOnvif: true,
      },
    ];
    setVendorPresets(presets);
  };

  const handleOpenDialog = (camera?: Camera) => {
    if (camera) {
      setEditingCamera(camera);
      setFormData({
        name: camera.name,
        streamUrl: camera.streamUrl,
        streamType: camera.streamType,
        username: camera.username || '',
        password: camera.password || '',
        enabled: camera.enabled,
        recordingMode: camera.recordingMode,
        vendor: camera.manufacturer || '',
        model: camera.model || '',
        ipAddress: '',
        port: '554',
        aiEnabled: camera.aiEnabled,
        supportsPTZ: camera.supportsPTZ,
        ptzType: '',
        audioEnabled: camera.audioEnabled,
        audioCodec: 'aac',
        twoWayAudio: false,
        motionSensitivity: camera.motionSensitivity,
        filteredDetectionClasses: [],
      });
    } else {
      setEditingCamera(null);
      setFormData({
        name: '',
        streamUrl: '',
        streamType: 'rtsp',
        username: '',
        password: '',
        enabled: true,
        recordingMode: 'continuous',
        vendor: '',
        model: '',
        ipAddress: '',
        port: '554',
        aiEnabled: true,
        supportsPTZ: false,
        ptzType: '',
        audioEnabled: true,
        audioCodec: 'aac',
        twoWayAudio: false,
        motionSensitivity: 50,
        filteredDetectionClasses: [],
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCamera(null);
    setError('');
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    setError('');

    try {
      // Build the stream URL from vendor preset if applicable
      const finalStreamUrl = formData.vendor && formData.ipAddress
        ? buildStreamUrl()
        : formData.streamUrl;

      const testData = {
        name: formData.name || 'Test Camera',
        streamUrl: finalStreamUrl,
        streamType: formData.streamType,
        username: formData.username || undefined,
        password: formData.password || undefined,
        enabled: true,
      };

      const result = await api.testCameraConnection(testData);
      setTestResult(result);
    } catch (err: any) {
      const errorData = err.response?.data;
      setTestResult({
        success: false,
        message: errorData?.message || 'Connection test failed',
        details: errorData?.details || { error: err.message },
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveCamera = async () => {
    try {
      // Build the stream URL from vendor preset if applicable
      const finalStreamUrl = formData.vendor && formData.ipAddress
        ? buildStreamUrl()
        : formData.streamUrl;

      const cameraData = {
        name: formData.name,
        streamUrl: finalStreamUrl,
        streamType: formData.streamType,
        username: formData.username || undefined,
        password: formData.password || undefined,
        enabled: formData.enabled,
        recordingMode: formData.recordingMode,
        manufacturer: formData.vendor, // Map vendor to manufacturer
        model: formData.model,
        aiEnabled: formData.aiEnabled,
        supportsPTZ: formData.supportsPTZ,
        ptzType: formData.ptzType || undefined,
        audioEnabled: formData.audioEnabled,
        audioCodec: formData.audioCodec,
        twoWayAudio: formData.twoWayAudio,
        motionSensitivity: formData.motionSensitivity,
        filteredDetectionClasses: JSON.stringify(formData.filteredDetectionClasses),
      };

      if (editingCamera) {
        await api.updateCamera(editingCamera.id, cameraData);
      } else {
        await api.createCamera(cameraData);
      }

      handleCloseDialog();
      loadCameras();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save camera');
    }
  };

  const handleDeleteCamera = async (id: string) => {
    try {
      await api.deleteCamera(id);
      loadCameras();
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete camera');
    }
  };

  const handleToggleEnabled = async (camera: Camera) => {
    try {
      await api.updateCamera(camera.id, {
        ...camera,
        enabled: !camera.enabled,
      });
      loadCameras();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update camera');
    }
  };

  const handleVendorChange = (vendor: string) => {
    const preset = vendorPresets.find((p) => p.vendor === vendor);
    if (preset) {
      setFormData({
        ...formData,
        vendor,
        streamType: preset.streamType,
        port: preset.defaultPort.toString(),
      });
    } else {
      setFormData({ ...formData, vendor });
    }
  };

  const buildStreamUrl = () => {
    const preset = vendorPresets.find((p) => p.vendor === formData.vendor);
    if (preset && formData.ipAddress) {
      // Don't include credentials in URL - backend will add them
      const path = preset.streamPath.replace('{channel}', '1');
      return `${preset.streamType}://${formData.ipAddress}:${formData.port}${path}`;
    }
    return formData.streamUrl;
  };

  return (
    <Layout title="Cameras">
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5">Camera Management</Typography>
          <Box>
            <IconButton onClick={loadCameras} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add Camera
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Typography>Loading cameras...</Typography>
        ) : cameras.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 8 }}>
              <VideocamIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No cameras configured
              </Typography>
              <Typography color="text.secondary" paragraph>
                Get started by adding your first camera
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
              >
                Add Camera
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {cameras.map((camera) => (
              <Grid item xs={12} sm={6} md={4} key={camera.id}>
                <Card>
                  <CardMedia
                    component="img"
                    height="200"
                    image={`/api/cameras/${camera.id}/snapshot`}
                    alt={camera.name}
                    sx={{ bgcolor: 'grey.900' }}
                    onError={(e: any) => {
                      e.target.src = '/placeholder-camera.png';
                    }}
                  />
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                      <Typography variant="h6" component="div">
                        {camera.name}
                      </Typography>
                      <Switch
                        checked={camera.enabled}
                        onChange={() => handleToggleEnabled(camera)}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {camera.manufacturer || 'Unknown'} - {camera.streamType.toUpperCase()}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                      <Chip label={camera.recordingMode} size="small" />
                      {camera.aiEnabled && <Chip label="AI" size="small" color="primary" />}
                      {camera.supportsPTZ && <Chip label="PTZ" size="small" color="secondary" />}
                      {camera.audioEnabled && <Chip label="Audio" size="small" />}
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button size="small" startIcon={<EditIcon />} onClick={() => handleOpenDialog(camera)}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => setDeleteConfirm(camera.id)}
                    >
                      Delete
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Add/Edit Camera Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingCamera ? 'Edit Camera' : 'Add Camera'}
          </DialogTitle>
          <DialogContent>
            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tab label="Basic" />
              <Tab label="Stream" />
              <Tab label="Recording" />
              <Tab label="AI & Motion" />
              <Tab label="PTZ & Audio" />
            </Tabs>

            {/* Basic Tab */}
            <TabPanel value={tabValue} index={0}>
              <TextField
                fullWidth
                label="Camera Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                margin="normal"
                required
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Vendor</InputLabel>
                <Select
                  value={formData.vendor}
                  onChange={(e) => handleVendorChange(e.target.value)}
                  label="Vendor"
                >
                  <MenuItem value="">Custom/Other</MenuItem>
                  {vendorPresets.map((preset) => (
                    <MenuItem key={preset.vendor} value={preset.vendor}>
                      {preset.vendor}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                margin="normal"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  />
                }
                label="Enable Camera"
              />
            </TabPanel>

            {/* Stream Tab */}
            <TabPanel value={tabValue} index={1}>
              {formData.vendor && (
                <>
                  <TextField
                    fullWidth
                    label="IP Address"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    margin="normal"
                    placeholder="192.168.1.100"
                  />
                  <TextField
                    fullWidth
                    label="Port"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    margin="normal"
                  />
                </>
              )}
              <FormControl fullWidth margin="normal">
                <InputLabel>Stream Type</InputLabel>
                <Select
                  value={formData.streamType}
                  onChange={(e) => setFormData({ ...formData, streamType: e.target.value })}
                  label="Stream Type"
                >
                  <MenuItem value="rtsp">RTSP</MenuItem>
                  <MenuItem value="rtmp">RTMP</MenuItem>
                  <MenuItem value="hls">HLS</MenuItem>
                  <MenuItem value="mjpeg">MJPEG</MenuItem>
                  <MenuItem value="onvif">ONVIF</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Stream URL"
                value={formData.vendor && formData.ipAddress ? buildStreamUrl() : formData.streamUrl}
                onChange={(e) => setFormData({ ...formData, streamUrl: e.target.value })}
                margin="normal"
                required
                helperText="Complete stream URL (auto-generated for vendor cameras)"
              />
              <TextField
                fullWidth
                label="Username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                margin="normal"
              />
              <TextField
                fullWidth
                type="password"
                label="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                margin="normal"
              />

              {/* Test Connection Button */}
              <Box sx={{ mt: 3 }}>
                <Button
                  variant="outlined"
                  onClick={handleTestConnection}
                  disabled={testingConnection || (!formData.streamUrl && !(formData.vendor && formData.ipAddress))}
                  fullWidth
                  startIcon={testingConnection ? <CircularProgress size={20} /> : undefined}
                >
                  {testingConnection ? 'Testing Connection...' : 'Test Connection'}
                </Button>
              </Box>

              {/* Test Results */}
              {testResult && (
                <Alert
                  severity={testResult.success ? 'success' : 'error'}
                  icon={testResult.success ? <CheckCircleIcon /> : <ErrorIcon />}
                  sx={{ mt: 2 }}
                >
                  <Typography variant="subtitle2" gutterBottom>
                    {testResult.message}
                  </Typography>
                  {testResult.details && (
                    <Box sx={{ mt: 1 }}>
                      {testResult.details.suggestion && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          <strong>Suggestion:</strong> {testResult.details.suggestion}
                        </Typography>
                      )}
                      {testResult.details.errorType && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          <strong>Error Type:</strong> {testResult.details.errorType}
                        </Typography>
                      )}
                      {testResult.details.error && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.8 }}>
                          Technical Details: {testResult.details.error}
                        </Typography>
                      )}
                      {testResult.details.stderr && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.8 }}>
                          FFmpeg: {testResult.details.stderr}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Alert>
              )}
            </TabPanel>

            {/* Recording Tab */}
            <TabPanel value={tabValue} index={2}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Recording Mode</InputLabel>
                <Select
                  value={formData.recordingMode}
                  onChange={(e) => setFormData({ ...formData, recordingMode: e.target.value })}
                  label="Recording Mode"
                >
                  <MenuItem value="continuous">Continuous (24/7)</MenuItem>
                  <MenuItem value="motion">Motion Detection</MenuItem>
                  <MenuItem value="ai_detection">AI Detection Only</MenuItem>
                  <MenuItem value="scheduled">Scheduled</MenuItem>
                  <MenuItem value="motion_and_scheduled">Motion + Scheduled</MenuItem>
                  <MenuItem value="motion_or_ai">Motion OR AI</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Storage and retention settings can be configured in System Settings
              </Typography>
            </TabPanel>

            {/* AI & Motion Tab */}
            <TabPanel value={tabValue} index={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.aiEnabled}
                    onChange={(e) => setFormData({ ...formData, aiEnabled: e.target.checked })}
                  />
                }
                label="Enable AI Detection"
              />
              <Typography variant="body2" color="text.secondary" gutterBottom sx={{ ml: 4 }}>
                Uses CodeProject.AI or Frigate for object detection
              </Typography>

              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                Motion Sensitivity
              </Typography>
              <TextField
                fullWidth
                type="number"
                value={formData.motionSensitivity}
                onChange={(e) => setFormData({ ...formData, motionSensitivity: parseInt(e.target.value) })}
                inputProps={{ min: 0, max: 100 }}
                helperText="0 = least sensitive, 100 = most sensitive"
              />
            </TabPanel>

            {/* PTZ & Audio Tab */}
            <TabPanel value={tabValue} index={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.supportsPTZ}
                    onChange={(e) => setFormData({ ...formData, supportsPTZ: e.target.checked })}
                  />
                }
                label="Supports PTZ (Pan/Tilt/Zoom)"
              />
              {formData.supportsPTZ && (
                <FormControl fullWidth margin="normal" sx={{ ml: 4 }}>
                  <InputLabel>PTZ Type</InputLabel>
                  <Select
                    value={formData.ptzType}
                    onChange={(e) => setFormData({ ...formData, ptzType: e.target.value })}
                    label="PTZ Type"
                  >
                    <MenuItem value="reolink">Reolink</MenuItem>
                    <MenuItem value="onvif">ONVIF</MenuItem>
                    <MenuItem value="custom">Custom</MenuItem>
                  </Select>
                </FormControl>
              )}

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.audioEnabled}
                    onChange={(e) => setFormData({ ...formData, audioEnabled: e.target.checked })}
                  />
                }
                label="Enable Audio Recording"
                sx={{ mt: 2 }}
              />
              {formData.audioEnabled && (
                <>
                  <FormControl fullWidth margin="normal" sx={{ ml: 4 }}>
                    <InputLabel>Audio Codec</InputLabel>
                    <Select
                      value={formData.audioCodec}
                      onChange={(e) => setFormData({ ...formData, audioCodec: e.target.value })}
                      label="Audio Codec"
                    >
                      <MenuItem value="aac">AAC</MenuItem>
                      <MenuItem value="mp3">MP3</MenuItem>
                      <MenuItem value="pcm">PCM</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.twoWayAudio}
                        onChange={(e) => setFormData({ ...formData, twoWayAudio: e.target.checked })}
                      />
                    }
                    label="Two-Way Audio"
                    sx={{ ml: 4 }}
                  />
                </>
              )}
            </TabPanel>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSaveCamera} variant="contained">
              {editingCamera ? 'Save' : 'Add Camera'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)}>
          <DialogTitle>Delete Camera</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this camera? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              onClick={() => deleteConfirm && handleDeleteCamera(deleteConfirm)}
              color="error"
              variant="contained"
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default Cameras;
