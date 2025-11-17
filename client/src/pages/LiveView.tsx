import React, { useEffect, useState } from 'react';
import { Grid, Card, CardContent, Typography, Box, Chip } from '@mui/material';
import { FiberManualRecord } from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';

const LiveView: React.FC = () => {
  const [cameras, setCameras] = useState<any[]>([]);

  useEffect(() => {
    loadCameras();
  }, []);

  const loadCameras = async () => {
    try {
      const data = await api.getCameras();
      setCameras(data.filter((c: any) => c.enabled));
    } catch (error) {
      console.error('Failed to load cameras:', error);
    }
  };

  return (
    <Layout title="Live View">
      <Grid container spacing={2}>
        {cameras.map((camera) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={camera.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="h6">{camera.name}</Typography>
                  <Chip
                    icon={<FiberManualRecord />}
                    label={camera.status}
                    size="small"
                    color={camera.status === 'online' ? 'success' : 'error'}
                  />
                </Box>
                <Box
                  sx={{
                    width: '100%',
                    paddingTop: '75%',
                    position: 'relative',
                    bgcolor: 'black',
                    borderRadius: 1,
                  }}
                >
                  {camera.isStreaming ? (
                    <video
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                      autoPlay
                      muted
                      src={api.getHLSUrl(camera.id)}
                    />
                  ) : (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        color: 'text.secondary',
                      }}
                    >
                      <Typography>No Stream</Typography>
                    </Box>
                  )}
                </Box>
                <Box mt={1} display="flex" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    {camera.isRecording ? '🔴 Recording' : 'Not Recording'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Viewers: {camera.viewers || 0}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {cameras.length === 0 && (
          <Grid item xs={12}>
            <Box textAlign="center" py={8}>
              <Typography color="text.secondary">
                No cameras configured. Add cameras in the Cameras page.
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>
    </Layout>
  );
};

export default LiveView;
