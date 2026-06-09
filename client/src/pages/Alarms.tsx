import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  IconButton,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Notifications as NotificationsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { format } from 'date-fns';

interface Alarm {
  id: string;
  name: string;
  enabled: boolean;
  cameraIds: string; // JSON array
  triggerOnMotion: boolean;
  triggerOnAI: boolean;
  severity: string;
  sendEmail: boolean;
  emailRecipients: string; // JSON array
  sendWebhook: boolean;
  webhookUrl?: string;
  sendPush: boolean;
  createdAt: Date;
}

// Safely parse a JSON-array column that may be a string, array, or empty.
function parseJsonArray(value: any): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

interface AlarmEvent {
  id: string;
  alarmId: string;
  cameraId?: string;
  message: string;
  severity: string;
  acknowledged: boolean;
  timestamp: string;
  alarm?: { name: string };
  camera?: { name: string };
}

interface Camera {
  id: string;
  name: string;
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

const Alarms: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [alarmEvents, setAlarmEvents] = useState<AlarmEvent[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<Alarm | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    enabled: true,
    type: 'motion', // 'motion' | 'ai_detection' | 'both'
    cameraId: '', // '' = all cameras
    severity: 'medium',
    notifyEmail: true,
    emailAddress: '',
    notifyWebhook: false,
    webhookUrl: '',
    notifyPush: false,
  });

  useEffect(() => {
    loadAlarms();
    loadAlarmEvents();
    loadCameras();
  }, []);

  const loadAlarms = async () => {
    try {
      const data = await api.getAlarms();
      setAlarms(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load alarms');
    } finally {
      setLoading(false);
    }
  };

  const loadAlarmEvents = async () => {
    try {
      const data = await api.getAlarmEvents();
      // The API returns { events, total, ... }; older shapes returned an array.
      setAlarmEvents(Array.isArray(data) ? data : data?.events || []);
    } catch (err: any) {
      console.error('Failed to load alarm events:', err);
    }
  };

  const loadCameras = async () => {
    try {
      const data = await api.getCameras();
      setCameras(data);
    } catch (err) {
      console.error('Failed to load cameras:', err);
    }
  };

  const handleOpenDialog = (alarm?: Alarm) => {
    if (alarm) {
      setEditingAlarm(alarm);
      const cameraIds = parseJsonArray(alarm.cameraIds);
      const recipients = parseJsonArray(alarm.emailRecipients);
      const type = alarm.triggerOnMotion && alarm.triggerOnAI
        ? 'both'
        : alarm.triggerOnAI ? 'ai_detection' : 'motion';
      setFormData({
        name: alarm.name,
        enabled: alarm.enabled,
        type,
        // Treat "monitors every camera" as the All Cameras option.
        cameraId: cameraIds.length === 1 ? cameraIds[0] : '',
        severity: alarm.severity || 'medium',
        notifyEmail: alarm.sendEmail || false,
        emailAddress: recipients[0] || '',
        notifyWebhook: alarm.sendWebhook || false,
        webhookUrl: alarm.webhookUrl || '',
        notifyPush: alarm.sendPush || false,
      });
    } else {
      setEditingAlarm(null);
      setFormData({
        name: '',
        enabled: true,
        type: 'motion',
        cameraId: '',
        severity: 'medium',
        notifyEmail: true,
        emailAddress: '',
        notifyWebhook: false,
        webhookUrl: '',
        notifyPush: false,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingAlarm(null);
    setError('');
  };

  const handleSaveAlarm = async () => {
    try {
      // "All cameras" maps to the full set of current camera ids, since the
      // backend matches alarms by explicit camera id membership.
      const cameraIds = formData.cameraId
        ? [formData.cameraId]
        : cameras.map((c) => c.id);

      const alarmData = {
        name: formData.name,
        enabled: formData.enabled,
        cameraIds: JSON.stringify(cameraIds),
        triggerOnMotion: formData.type === 'motion' || formData.type === 'both',
        triggerOnAI: formData.type === 'ai_detection' || formData.type === 'both',
        severity: formData.severity,
        sendEmail: formData.notifyEmail,
        emailRecipients: JSON.stringify(
          formData.emailAddress ? [formData.emailAddress] : []
        ),
        sendWebhook: formData.notifyWebhook,
        webhookUrl: formData.webhookUrl || undefined,
        sendPush: formData.notifyPush,
      };

      if (editingAlarm) {
        await api.updateAlarm(editingAlarm.id, alarmData);
      } else {
        await api.createAlarm(alarmData);
      }

      handleCloseDialog();
      loadAlarms();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save alarm');
    }
  };

  const handleDeleteAlarm = async (id: string) => {
    try {
      await api.deleteAlarm(id);
      loadAlarms();
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete alarm');
    }
  };

  const handleToggleEnabled = async (alarm: Alarm) => {
    try {
      await api.updateAlarm(alarm.id, {
        ...alarm,
        enabled: !alarm.enabled,
      });
      loadAlarms();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update alarm');
    }
  };

  const handleTestAlarm = async (id: string) => {
    try {
      await api.testAlarm(id);
      setError('Test notification sent successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send test notification');
    }
  };

  const handleAcknowledgeEvent = async (id: string) => {
    try {
      await api.acknowledgeAlarmEvent(id);
      loadAlarmEvents();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to acknowledge event');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <Layout title="Alarms">
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5">Alarm Management</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Alarm
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Alarm Rules" />
          <Tab label="Alarm Events" />
        </Tabs>

        {/* Alarm Rules Tab */}
        <TabPanel value={tabValue} index={0}>
          {loading ? (
            <Typography>Loading alarms...</Typography>
          ) : alarms.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 8 }}>
                <NotificationsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No alarms configured
                </Typography>
                <Typography color="text.secondary" paragraph>
                  Get started by creating your first alarm rule
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                >
                  Add Alarm
                </Button>
              </CardContent>
            </Card>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Camera</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {alarms.map((alarm) => {
                    const alarmCameraIds = parseJsonArray(alarm.cameraIds);
                    const triggerLabel = alarm.triggerOnMotion && alarm.triggerOnAI
                      ? 'Motion + AI'
                      : alarm.triggerOnAI ? 'AI Detection' : 'Motion';
                    const cameraLabel = alarmCameraIds.length === 1
                      ? cameras.find((c) => c.id === alarmCameraIds[0])?.name || 'Unknown'
                      : alarmCameraIds.length === 0 ? 'None' : 'All Cameras';
                    return (
                    <TableRow key={alarm.id}>
                      <TableCell>{alarm.name}</TableCell>
                      <TableCell>
                        <Chip label={triggerLabel} size="small" />
                      </TableCell>
                      <TableCell>
                        {cameraLabel}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={alarm.enabled}
                          onChange={() => handleToggleEnabled(alarm)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleTestAlarm(alarm.id)} title="Test">
                          <NotificationsIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleOpenDialog(alarm)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(alarm.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* Alarm Events Tab */}
        <TabPanel value={tabValue} index={1}>
          {alarmEvents.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary">
                No alarm events
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Alarm events will appear here when triggered
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Alarm</TableCell>
                    <TableCell>Camera</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {alarmEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        {event.timestamp ? format(new Date(event.timestamp), 'MMM dd, HH:mm:ss') : 'N/A'}
                      </TableCell>
                      <TableCell>{event.alarm?.name || 'N/A'}</TableCell>
                      <TableCell>{event.camera?.name || 'N/A'}</TableCell>
                      <TableCell>{event.message}</TableCell>
                      <TableCell>
                        <Chip
                          label={event.severity}
                          size="small"
                          color={getSeverityColor(event.severity) as any}
                        />
                      </TableCell>
                      <TableCell>
                        {event.acknowledged ? (
                          <Chip
                            icon={<CheckCircleIcon />}
                            label="Acknowledged"
                            size="small"
                            color="success"
                          />
                        ) : (
                          <Chip
                            icon={<ErrorIcon />}
                            label="Pending"
                            size="small"
                            color="warning"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {!event.acknowledged && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleAcknowledgeEvent(event.id)}
                          >
                            Acknowledge
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* Add/Edit Alarm Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingAlarm ? 'Edit Alarm' : 'Add Alarm'}
          </DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Alarm Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="normal"
              required
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Alarm Type</InputLabel>
              <Select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                label="Alarm Type"
              >
                <MenuItem value="motion">Motion Detection</MenuItem>
                <MenuItem value="ai_detection">AI Detection</MenuItem>
                <MenuItem value="both">Motion + AI Detection</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel>Severity</InputLabel>
              <Select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                label="Severity"
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel>Camera</InputLabel>
              <Select
                value={formData.cameraId}
                onChange={(e) => setFormData({ ...formData, cameraId: e.target.value })}
                label="Camera"
              >
                <MenuItem value="">All Cameras</MenuItem>
                {cameras.map((camera) => (
                  <MenuItem key={camera.id} value={camera.id}>
                    {camera.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
              }
              label="Enable Alarm"
            />

            <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
              Notification Actions
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={formData.notifyEmail}
                  onChange={(e) => setFormData({ ...formData, notifyEmail: e.target.checked })}
                />
              }
              label="Email Notification"
            />
            {formData.notifyEmail && (
              <TextField
                fullWidth
                label="Email Address"
                value={formData.emailAddress}
                onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
                margin="normal"
                type="email"
              />
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={formData.notifyWebhook}
                  onChange={(e) => setFormData({ ...formData, notifyWebhook: e.target.checked })}
                />
              }
              label="Webhook Notification"
            />
            {formData.notifyWebhook && (
              <TextField
                fullWidth
                label="Webhook URL"
                value={formData.webhookUrl}
                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                margin="normal"
                type="url"
              />
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={formData.notifyPush}
                  onChange={(e) => setFormData({ ...formData, notifyPush: e.target.checked })}
                />
              }
              label="Push Notification (enrolled devices)"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSaveAlarm} variant="contained" disabled={!formData.name}>
              {editingAlarm ? 'Save' : 'Add Alarm'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)}>
          <DialogTitle>Delete Alarm</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this alarm? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              onClick={() => deleteConfirm && handleDeleteAlarm(deleteConfirm)}
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

export default Alarms;
