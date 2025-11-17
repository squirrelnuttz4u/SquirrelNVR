import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  Typography,
  TextField,
  Button,
  Grid,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
  MenuItem,
} from '@mui/material';
import {
  Save,
  Storage,
  Email,
  Settings as SettingsIcon,
  SmartToy,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Settings: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // System Settings State
  const [settings, setSettings] = useState({
    // Storage
    storagePath: '/storage',
    maxStorageGB: 500,
    defaultRetentionDays: 30,
    autoDeleteOldRecordings: true,

    // Email
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '',
    emailFrom: '',
    emailEnabled: false,

    // Recording
    defaultRecordingMode: 'motion',
    defaultVideoCodec: 'h264',
    defaultAudioCodec: 'aac',
    defaultResolution: '1920x1080',
    defaultFrameRate: 30,

    // AI
    aiModelPath: './models',
    aiConfidenceThreshold: 0.7,
    aiEnabled: true,
    aiDetectionTypes: ['person', 'car', 'truck'],
  });

  const [storageStats, setStorageStats] = useState<any>(null);

  useEffect(() => {
    loadSettings();
    loadStorageStats();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSystemSettings();
      if (data) {
        setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadStorageStats = async () => {
    try {
      const data = await api.getStorageStats();
      setStorageStats(data);
    } catch (error) {
      console.error('Failed to load storage stats:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateSystemSettings(settings);
      setSuccess('Settings saved successfully');
      loadStorageStats(); // Reload stats if storage settings changed
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      setError(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!settings.emailFrom) {
      setError('Please enter an email address to send the test to');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.sendTestEmail(settings.emailFrom);
      setSuccess('Test email sent successfully');
    } catch (error: any) {
      console.error('Failed to send test email:', error);
      setError(error.response?.data?.error || 'Failed to send test email');
    } finally {
      setSaving(false);
    }
  };

  const handleStorageCleanup = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.performStorageCleanup();
      setSuccess('Storage cleanup completed');
      loadStorageStats();
    } catch (error: any) {
      console.error('Failed to perform storage cleanup:', error);
      setError(error.response?.data?.error || 'Failed to perform storage cleanup');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <Layout title="Settings">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="Settings">
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)}>
            <Tab icon={<SettingsIcon />} label="General" iconPosition="start" />
            <Tab icon={<Storage />} label="Storage" iconPosition="start" />
            <Tab icon={<Email />} label="Email" iconPosition="start" />
            <Tab icon={<SmartToy />} label="AI Detection" iconPosition="start" />
          </Tabs>
        </Box>

        {/* General Settings Tab */}
        <TabPanel value={currentTab} index={0}>
          <Typography variant="h6" gutterBottom>
            General Settings
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Default Recording Mode"
                select
                value={settings.defaultRecordingMode}
                onChange={(e) => handleChange('defaultRecordingMode', e.target.value)}
              >
                <MenuItem value="continuous">Continuous</MenuItem>
                <MenuItem value="motion">Motion Detection</MenuItem>
                <MenuItem value="ai">AI Detection</MenuItem>
                <MenuItem value="scheduled">Scheduled</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Default Video Codec"
                select
                value={settings.defaultVideoCodec}
                onChange={(e) => handleChange('defaultVideoCodec', e.target.value)}
              >
                <MenuItem value="h264">H.264</MenuItem>
                <MenuItem value="h265">H.265 (HEVC)</MenuItem>
                <MenuItem value="vp9">VP9</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Default Resolution"
                select
                value={settings.defaultResolution}
                onChange={(e) => handleChange('defaultResolution', e.target.value)}
              >
                <MenuItem value="3840x2160">4K (3840x2160)</MenuItem>
                <MenuItem value="2560x1440">2K (2560x1440)</MenuItem>
                <MenuItem value="1920x1080">1080p (1920x1080)</MenuItem>
                <MenuItem value="1280x720">720p (1280x720)</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Default Frame Rate"
                value={settings.defaultFrameRate}
                onChange={(e) => handleChange('defaultFrameRate', parseInt(e.target.value))}
                InputProps={{ inputProps: { min: 1, max: 60 } }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Default Audio Codec"
                select
                value={settings.defaultAudioCodec}
                onChange={(e) => handleChange('defaultAudioCodec', e.target.value)}
              >
                <MenuItem value="aac">AAC</MenuItem>
                <MenuItem value="mp3">MP3</MenuItem>
                <MenuItem value="opus">Opus</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Storage Settings Tab */}
        <TabPanel value={currentTab} index={1}>
          <Typography variant="h6" gutterBottom>
            Storage Settings
          </Typography>
          <Divider sx={{ mb: 3 }} />

          {storageStats && (
            <Alert severity="info" sx={{ mb: 3 }}>
              Current Storage: {storageStats.usedGB?.toFixed(2)} GB /{' '}
              {storageStats.totalGB} GB ({storageStats.usagePercent?.toFixed(1)}% used)
              <br />
              Recordings: {storageStats.recordingsCount || 0}
            </Alert>
          )}

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Storage Path"
                value={settings.storagePath}
                onChange={(e) => handleChange('storagePath', e.target.value)}
                helperText="Directory where recordings will be stored"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Maximum Storage (GB)"
                value={settings.maxStorageGB}
                onChange={(e) => handleChange('maxStorageGB', parseInt(e.target.value))}
                InputProps={{ inputProps: { min: 10, max: 10000 } }}
                helperText="Maximum storage space to use for recordings"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Default Retention (Days)"
                value={settings.defaultRetentionDays}
                onChange={(e) => handleChange('defaultRetentionDays', parseInt(e.target.value))}
                InputProps={{ inputProps: { min: 1, max: 365 } }}
                helperText="How long to keep recordings before deletion"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.autoDeleteOldRecordings}
                    onChange={(e) => handleChange('autoDeleteOldRecordings', e.target.checked)}
                  />
                }
                label="Automatically delete old recordings when retention period expires"
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Button
                variant="outlined"
                onClick={handleStorageCleanup}
                disabled={saving}
              >
                Run Storage Cleanup Now
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                Manually trigger storage cleanup to remove old recordings
              </Typography>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Email Settings Tab */}
        <TabPanel value={currentTab} index={2}>
          <Typography variant="h6" gutterBottom>
            Email / SMTP Settings
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.emailEnabled}
                    onChange={(e) => handleChange('emailEnabled', e.target.checked)}
                  />
                }
                label="Enable Email Notifications"
              />
            </Grid>

            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="SMTP Host"
                value={settings.smtpHost}
                onChange={(e) => handleChange('smtpHost', e.target.value)}
                disabled={!settings.emailEnabled}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="SMTP Port"
                value={settings.smtpPort}
                onChange={(e) => handleChange('smtpPort', parseInt(e.target.value))}
                disabled={!settings.emailEnabled}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="SMTP Username"
                value={settings.smtpUser}
                onChange={(e) => handleChange('smtpUser', e.target.value)}
                disabled={!settings.emailEnabled}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="password"
                label="SMTP Password"
                value={settings.smtpPassword}
                onChange={(e) => handleChange('smtpPassword', e.target.value)}
                disabled={!settings.emailEnabled}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="From Email Address"
                value={settings.emailFrom}
                onChange={(e) => handleChange('emailFrom', e.target.value)}
                disabled={!settings.emailEnabled}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.smtpSecure}
                    onChange={(e) => handleChange('smtpSecure', e.target.checked)}
                    disabled={!settings.emailEnabled}
                  />
                }
                label="Use TLS/SSL"
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Button
                variant="outlined"
                onClick={handleTestEmail}
                disabled={!settings.emailEnabled || saving}
              >
                Send Test Email
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                Send a test email to verify SMTP settings
              </Typography>
            </Grid>
          </Grid>
        </TabPanel>

        {/* AI Detection Settings Tab */}
        <TabPanel value={currentTab} index={3}>
          <Typography variant="h6" gutterBottom>
            AI Detection Settings
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.aiEnabled}
                    onChange={(e) => handleChange('aiEnabled', e.target.checked)}
                  />
                }
                label="Enable AI Detection"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="AI Model Path"
                value={settings.aiModelPath}
                onChange={(e) => handleChange('aiModelPath', e.target.value)}
                disabled={!settings.aiEnabled}
                helperText="Directory where AI models are stored"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Confidence Threshold"
                value={settings.aiConfidenceThreshold}
                onChange={(e) => handleChange('aiConfidenceThreshold', parseFloat(e.target.value))}
                disabled={!settings.aiEnabled}
                InputProps={{
                  inputProps: { min: 0, max: 1, step: 0.05 },
                }}
                helperText="Minimum confidence (0-1) required for detections"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Detection Types
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {['person', 'car', 'truck', 'bicycle', 'motorcycle', 'bus', 'dog', 'cat'].map(
                  (type) => (
                    <FormControlLabel
                      key={type}
                      control={
                        <Switch
                          checked={settings.aiDetectionTypes?.includes(type)}
                          onChange={(e) => {
                            const types = e.target.checked
                              ? [...(settings.aiDetectionTypes || []), type]
                              : (settings.aiDetectionTypes || []).filter((t) => t !== type);
                            handleChange('aiDetectionTypes', types);
                          }}
                          disabled={!settings.aiEnabled}
                        />
                      }
                      label={type.charAt(0).toUpperCase() + type.slice(1)}
                    />
                  )
                )}
              </Box>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Save Button */}
        <Box sx={{ p: 3, pt: 0 }}>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <Save />}
            onClick={handleSave}
            disabled={saving}
            size="large"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Box>
      </Card>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSuccess(null)} severity="success">
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Layout>
  );
};

export default Settings;
