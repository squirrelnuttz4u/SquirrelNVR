import React, { useEffect, useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Button,
  IconButton,
} from '@mui/material';
import {
  Videocam,
  VideoLibrary,
  SmartToy,
  Storage,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Refresh,
  Person,
  DirectionsCar,
  Notifications,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import { formatDistanceToNow } from 'date-fns';

interface Camera {
  id: string;
  name: string;
  enabled: boolean;
  status?: 'online' | 'offline' | 'error';
  lastSeen?: Date;
}

interface Detection {
  id: string;
  type: string;
  confidence: number;
  cameraId: string;
  cameraName: string;
  detectedAt: Date;
}

interface AlarmEvent {
  id: string;
  alarmName: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: Date;
  acknowledged: boolean;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [recentDetections, setRecentDetections] = useState<Detection[]>([]);
  const [recentAlarms, setRecentAlarms] = useState<AlarmEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    loadAllData();
    const interval = setInterval(loadAllData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (lastMessage) {
      handleWebSocketMessage(lastMessage);
    }
  }, [lastMessage]);

  const handleWebSocketMessage = (message: any) => {
    if (message.type === 'detection') {
      setRecentDetections((prev) => [message.data, ...prev.slice(0, 9)]);
    } else if (message.type === 'alarm') {
      setRecentAlarms((prev) => [message.data, ...prev.slice(0, 9)]);
    } else if (message.type === 'camera:status') {
      setCameras((prev) =>
        prev.map((cam) =>
          cam.id === message.data.cameraId
            ? { ...cam, status: message.data.status, lastSeen: new Date() }
            : cam
        )
      );
    } else if (message.type === 'stats') {
      setStats(message.data);
    }
  };

  const loadAllData = async () => {
    try {
      const [statsData, camerasData, detectionsData, alarmsData] = await Promise.all([
        api.getSystemStats(),
        api.getCameras(),
        api.getDetections({ limit: 10, sort: 'detectedAt:desc' }),
        api.getAlarmEvents({ limit: 10, sort: 'createdAt:desc' }),
      ]);

      setStats(statsData);
      setCameras(camerasData);
      setRecentDetections(detectionsData);
      setRecentAlarms(alarmsData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    loadAllData();
  };

  const handleAcknowledgeAlarm = async (id: string) => {
    try {
      await api.acknowledgeAlarmEvent(id);
      setRecentAlarms((prev) =>
        prev.map((alarm) =>
          alarm.id === id ? { ...alarm, acknowledged: true } : alarm
        )
      );
    } catch (error) {
      console.error('Failed to acknowledge alarm:', error);
    }
  };

  if (loading || !stats) {
    return (
      <Layout title="Dashboard">
        <Box sx={{ width: '100%' }}>
          <LinearProgress />
        </Box>
      </Layout>
    );
  }

  const statCards = [
    {
      title: 'Active Cameras',
      value: `${stats.activeCameras} / ${stats.totalCameras}`,
      icon: <Videocam fontSize="large" />,
      color: '#2196f3',
    },
    {
      title: 'Recordings',
      value: stats.recordingsCount.toLocaleString(),
      icon: <VideoLibrary fontSize="large" />,
      color: '#4caf50',
    },
    {
      title: 'AI Detections Today',
      value: stats.detectionsToday.toLocaleString(),
      icon: <SmartToy fontSize="large" />,
      color: '#ff9800',
    },
    {
      title: 'Storage Used',
      value: `${stats.storageUsed.toFixed(1)} / ${stats.storageTotal} GB`,
      icon: <Storage fontSize="large" />,
      color: '#f44336',
    },
  ];

  const getDetectionIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'person':
        return <Person />;
      case 'car':
      case 'vehicle':
        return <DirectionsCar />;
      default:
        return <SmartToy />;
    }
  };

  return (
    <Layout title="Dashboard">
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={handleRefresh}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      <Grid container spacing={3}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Box
                    sx={{
                      bgcolor: card.color,
                      borderRadius: 1,
                      p: 1,
                      mr: 2,
                      display: 'flex',
                      color: 'white',
                    }}
                  >
                    {card.icon}
                  </Box>
                  <Typography color="text.secondary" variant="body2">
                    {card.title}
                  </Typography>
                </Box>
                <Typography variant="h4">{card.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {/* Camera Status Grid */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Camera Status
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Camera</TableCell>
                      <TableCell align="center">Status</TableCell>
                      <TableCell align="right">Last Seen</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cameras.slice(0, 5).map((camera) => (
                      <TableRow key={camera.id}>
                        <TableCell>{camera.name}</TableCell>
                        <TableCell align="center">
                          {!camera.enabled ? (
                            <Chip
                              label="Disabled"
                              size="small"
                              color="default"
                            />
                          ) : camera.status === 'online' ? (
                            <Chip
                              icon={<CheckCircle />}
                              label="Online"
                              size="small"
                              color="success"
                            />
                          ) : camera.status === 'error' ? (
                            <Chip
                              icon={<ErrorIcon />}
                              label="Error"
                              size="small"
                              color="error"
                            />
                          ) : (
                            <Chip
                              icon={<Warning />}
                              label="Offline"
                              size="small"
                              color="warning"
                            />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="caption" color="text.secondary">
                            {camera.lastSeen
                              ? formatDistanceToNow(new Date(camera.lastSeen), {
                                  addSuffix: true,
                                })
                              : 'Never'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {cameras.length === 0 && (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No cameras configured
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent AI Detections */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent AI Detections
              </Typography>
              <List>
                {recentDetections.slice(0, 5).map((detection) => (
                  <ListItem key={detection.id} dense>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: '#ff9800' }}>
                        {getDetectionIcon(detection.type)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${detection.type} (${(detection.confidence * 100).toFixed(0)}%)`}
                      secondary={`${detection.cameraName} • ${formatDistanceToNow(
                        new Date(detection.detectedAt),
                        { addSuffix: true }
                      )}`}
                    />
                  </ListItem>
                ))}
              </List>
              {recentDetections.length === 0 && (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No recent detections
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* System Performance */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Performance
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  CPU Usage
                </Typography>
                <Box display="flex" alignItems="center">
                  <Box sx={{ width: '100%', mr: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={stats.cpuUsage}
                      color={stats.cpuUsage > 80 ? 'error' : 'primary'}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {stats.cpuUsage.toFixed(1)}%
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Memory Usage
                </Typography>
                <Box display="flex" alignItems="center">
                  <Box sx={{ width: '100%', mr: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={stats.memoryUsage}
                      color={stats.memoryUsage > 80 ? 'error' : 'primary'}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {stats.memoryUsage.toFixed(1)}%
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Disk Usage
                </Typography>
                <Box display="flex" alignItems="center">
                  <Box sx={{ width: '100%', mr: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={stats.diskUsage}
                      color={stats.diskUsage > 80 ? 'error' : 'primary'}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {stats.diskUsage.toFixed(1)}%
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Uptime: {Math.floor(stats.uptime / 3600)}h{' '}
                  {Math.floor((stats.uptime % 3600) / 60)}m
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Storage: {stats.storageUsed.toFixed(2)} GB / {stats.storageTotal} GB (
                  {((stats.storageUsed / stats.storageTotal) * 100).toFixed(1)}%)
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Alarms */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Alarms
              </Typography>
              <List>
                {recentAlarms.slice(0, 5).map((alarm) => (
                  <ListItem
                    key={alarm.id}
                    dense
                    secondaryAction={
                      !alarm.acknowledged && (
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleAcknowledgeAlarm(alarm.id)}
                        >
                          <CheckCircle />
                        </IconButton>
                      )
                    }
                  >
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          bgcolor:
                            alarm.severity === 'critical'
                              ? '#f44336'
                              : alarm.severity === 'warning'
                              ? '#ff9800'
                              : '#2196f3',
                        }}
                      >
                        <Notifications />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          {alarm.alarmName}
                          {alarm.acknowledged && (
                            <Chip label="Ack" size="small" color="success" />
                          )}
                        </Box>
                      }
                      secondary={`${alarm.message} • ${formatDistanceToNow(
                        new Date(alarm.createdAt),
                        { addSuffix: true }
                      )}`}
                    />
                  </ListItem>
                ))}
              </List>
              {recentAlarms.length === 0 && (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No recent alarms
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Layout>
  );
};

export default Dashboard;
