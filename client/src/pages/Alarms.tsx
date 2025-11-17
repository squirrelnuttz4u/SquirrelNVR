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
  type: string;
  cameraId?: string;
  conditions: any;
  actions: any;
  createdAt: Date;
}

interface AlarmEvent {
  id: string;
  alarmId: string;
  alarmName: string;
  cameraId?: string;
  cameraName?: string;
  message: string;
  severity: string;
  acknowledged: boolean;
  triggeredAt: Date;
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
    type: 'motion',
    cameraId: '',
    notifyEmail: true,
    emailAddress: '',
    notifyWebhook: false,
    webhookUrl: '',
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
      setAlarmEvents(data);
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
      const actions = alarm.actions || {};
      setFormData({
        name: alarm.name,
        enabled: alarm.enabled,
        type: alarm.type,
        cameraId: alarm.cameraId || '',
        notifyEmail: actions.email || false,
        emailAddress: actions.emailAddress || '',
        notifyWebhook: actions.webhook || false,
        webhookUrl: actions.webhookUrl || '',
      });
    } else {
      setEditingAlarm(null);
      setFormData({
        name: '',
        enabled: true,
        type: 'motion',
        cameraId: '',
        notifyEmail: true,
        emailAddress: '',
        notifyWebhook: false,
        webhookUrl: '',
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
      const alarmData = {
        name: formData.name,
        enabled: formData.enabled,
        type: formData.type,
        cameraId: formData.cameraId || undefined,
        conditions: {
          type: formData.type,
        },
        actions: {
          email: formData.notifyEmail,
          emailAddress: formData.emailAddress,
          webhook: formData.notifyWebhook,
          webhookUrl: formData.webhookUrl,
        },
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
                  {alarms.map((alarm) => (
                    <TableRow key={alarm.id}>
                      <TableCell>{alarm.name}</TableCell>
                      <TableCell>
                        <Chip label={alarm.type} size="small" />
                      </TableCell>
                      <TableCell>
                        {alarm.cameraId
                          ? cameras.find((c) => c.id === alarm.cameraId)?.name || 'Unknown'
                          : 'All Cameras'}
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
                  ))}
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
                        {format(new Date(event.triggeredAt), 'MMM dd, HH:mm:ss')}
                      </TableCell>
                      <TableCell>{event.alarmName}</TableCell>
                      <TableCell>{event.cameraName || 'N/A'}</TableCell>
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
                <MenuItem value="camera_offline">Camera Offline</MenuItem>
                <MenuItem value="storage_full">Storage Full</MenuItem>
                <MenuItem value="system_error">System Error</MenuItem>
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
