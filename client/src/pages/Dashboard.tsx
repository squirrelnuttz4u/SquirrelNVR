import React, { useEffect, useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
} from '@mui/material';
import {
  Videocam,
  VideoLibrary,
  SmartToy,
  Storage,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const data = await api.getSystemStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
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

  return (
    <Layout title="Dashboard">
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
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Info
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Uptime: {Math.floor(stats.uptime / 3600)}h {Math.floor((stats.uptime % 3600) / 60)}m
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Storage: {stats.storageUsed.toFixed(2)} GB / {stats.storageTotal} GB
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Storage Available: {(stats.storageTotal - stats.storageUsed).toFixed(2)} GB
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Layout>
  );
};

export default Dashboard;
