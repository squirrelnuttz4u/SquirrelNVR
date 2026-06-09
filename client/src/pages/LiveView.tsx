import React, { useEffect, useState, useRef } from 'react';
import { Grid, Card, CardContent, Typography, Box, Chip, CircularProgress, Alert, IconButton } from '@mui/material';
import {
  FiberManualRecord,
  KeyboardArrowUp,
  KeyboardArrowDown,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Add as ZoomInIcon,
  Remove as ZoomOutIcon,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

interface CameraWithStatus {
  id: string;
  name: string;
  enabled: boolean;
  status?: string;
  isStreaming?: boolean;
  isRecording?: boolean;
  motionMonitoring?: boolean;
  supportsPTZ?: boolean;
  viewers?: number;
}

// PTZ directional controls. Holds the move while the button is pressed and
// sends a stop on release (matching ONVIF continuous-move semantics).
const PTZControls: React.FC<{ cameraId: string }> = ({ cameraId }) => {
  const send = (action: string) => {
    api.ptzCommand(cameraId, action, 50).catch(() => { /* surfaced via console */ });
  };
  const stop = () => {
    api.ptzCommand(cameraId, 'stop').catch(() => { /* ignore */ });
  };

  const btn = (action: string, icon: React.ReactNode, label: string) => (
    <IconButton
      size="small"
      aria-label={label}
      onMouseDown={() => send(action)}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={() => send(action)}
      onTouchEnd={stop}
    >
      {icon}
    </IconButton>
  );

  return (
    <Box mt={1} display="flex" justifyContent="space-between" alignItems="center">
      <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={0}>
        <Box />
        {btn('up', <KeyboardArrowUp fontSize="small" />, 'Tilt up')}
        <Box />
        {btn('left', <KeyboardArrowLeft fontSize="small" />, 'Pan left')}
        <Box />
        {btn('right', <KeyboardArrowRight fontSize="small" />, 'Pan right')}
        <Box />
        {btn('down', <KeyboardArrowDown fontSize="small" />, 'Tilt down')}
        <Box />
      </Box>
      <Box display="flex" flexDirection="column">
        {btn('zoomIn', <ZoomInIcon fontSize="small" />, 'Zoom in')}
        {btn('zoomOut', <ZoomOutIcon fontSize="small" />, 'Zoom out')}
      </Box>
    </Box>
  );
};

const VideoPlayer: React.FC<{ camera: CameraWithStatus }> = ({ camera }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    // Initialize Video.js player
    const player = videojs(videoRef.current, {
      controls: true,
      autoplay: true,
      muted: true,
      preload: 'auto',
      fluid: true,
      aspectRatio: '16:9',
      html5: {
        vhs: {
          overrideNative: true,
        },
        nativeVideoTracks: false,
        nativeAudioTracks: false,
        nativeTextTracks: false,
      },
    });

    playerRef.current = player;

    // Set source if streaming
    if (camera.isStreaming) {
      player.src({
        src: api.getHLSUrl(camera.id),
        type: 'application/x-mpegURL',
      });
    }

    // Cleanup
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
      }
    };
  }, [camera.id, camera.isStreaming]);

  if (!camera.isStreaming) {
    return (
      <Box
        sx={{
          width: '100%',
          height: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'black',
          borderRadius: 1,
          color: 'text.secondary',
        }}
      >
        <Typography>No Stream Available</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', bgcolor: 'black', borderRadius: 1 }}>
      <div data-vjs-player>
        <video
          ref={videoRef}
          className="video-js vjs-default-skin"
          playsInline
        />
      </div>
    </Box>
  );
};

const LiveView: React.FC = () => {
  const [cameras, setCameras] = useState<CameraWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCameras();
    const interval = setInterval(loadCameras, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadCameras = async () => {
    try {
      setError(null);
      const data = await api.getCameras();
      const enabledCameras = Array.isArray(data) ? data.filter((c: any) => c.enabled) : [];
      setCameras(enabledCameras);
    } catch (err: any) {
      console.error('Failed to load cameras:', err);
      setError(err.response?.data?.error || 'Failed to load cameras. Make sure the backend server is running.');
      setCameras([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Live View">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Live View">
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Layout>
    );
  }

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
                    label={camera.isStreaming ? 'Streaming' : 'Offline'}
                    size="small"
                    color={camera.isStreaming ? 'success' : 'error'}
                  />
                </Box>

                <VideoPlayer camera={camera} />

                <Box mt={1} display="flex" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    {camera.isRecording ? '🔴 Recording' : 'Not Recording'}
                    {camera.motionMonitoring ? ' · 👁 Motion' : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Viewers: {camera.viewers || 0}
                  </Typography>
                </Box>

                {camera.supportsPTZ && <PTZControls cameraId={camera.id} />}
              </CardContent>
            </Card>
          </Grid>
        ))}

        {cameras.length === 0 && (
          <Grid item xs={12}>
            <Box textAlign="center" py={8}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Cameras Configured
              </Typography>
              <Typography color="text.secondary">
                Add cameras in the Cameras page to see live feeds here.
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>
    </Layout>
  );
};

export default LiveView;
