import React, { useEffect, useState } from 'react';
import {
  Grid,
  Card,
  CardMedia,
  CardContent,
  Typography,
  Box,
  TextField,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
} from '@mui/material';
import {
  Close,
  Search,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';
import { format } from 'date-fns';

interface Detection {
  id: string;
  cameraId: string;
  cameraName: string;
  type: string;
  confidence: number;
  label: string;
  bbox?: { x: number; y: number; width: number; height: number };
  snapshotPath: string;
  detectedAt: Date;
}

interface Camera {
  id: string;
  name: string;
}

const Detections: React.FC = () => {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCamera, setSelectedCamera] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(
    new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
  );
  const [endDate, setEndDate] = useState<Date | null>(new Date());

  // Detail dialog
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);

  useEffect(() => {
    loadCameras();
  }, []);

  useEffect(() => {
    loadDetections();
  }, [selectedCamera, selectedType, startDate, endDate]);

  const loadCameras = async () => {
    try {
      const data = await api.getCameras();
      setCameras(data);
    } catch (error) {
      console.error('Failed to load cameras:', error);
    }
  };

  const loadDetections = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        sort: 'detectedAt:desc',
        limit: 100,
      };

      if (selectedCamera !== 'all') {
        params.cameraId = selectedCamera;
      }

      if (selectedType !== 'all') {
        params.type = selectedType;
      }

      if (startDate) {
        params.startDate = startDate.toISOString();
      }

      if (endDate) {
        params.endDate = endDate.toISOString();
      }

      const data = await api.getDetections(params);
      setDetections(data);
    } catch (error: any) {
      console.error('Failed to load detections:', error);
      setError(error.response?.data?.error || 'Failed to load detections');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (detection: Detection) => {
    setSelectedDetection(detection);
    setDetailDialog(true);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'success';
    if (confidence >= 0.7) return 'primary';
    if (confidence >= 0.5) return 'warning';
    return 'default';
  };

  const filteredDetections = detections.filter((detection) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        detection.label.toLowerCase().includes(query) ||
        detection.cameraName.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <Layout title="AI Detections">
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                size="small"
                select
                label="Camera"
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
              >
                <MenuItem value="all">All Cameras</MenuItem>
                {cameras.map((camera) => (
                  <MenuItem key={camera.id} value={camera.id}>
                    {camera.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                size="small"
                select
                label="Type"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="person">Person</MenuItem>
                <MenuItem value="car">Car</MenuItem>
                <MenuItem value="truck">Truck</MenuItem>
                <MenuItem value="dog">Dog</MenuItem>
                <MenuItem value="cat">Cat</MenuItem>
                <MenuItem value="bicycle">Bicycle</MenuItem>
                <MenuItem value="motorcycle">Motorcycle</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                size="small"
                type="datetime-local"
                label="Start Date"
                value={startDate ? format(startDate, "yyyy-MM-dd'T'HH:mm") : ''}
                onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : null)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                size="small"
                type="datetime-local"
                label="End Date"
                value={endDate ? format(endDate, "yyyy-MM-dd'T'HH:mm") : ''}
                onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} md={1}>
              <Button
                fullWidth
                variant="outlined"
                onClick={loadDetections}
              >
                Apply
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Found {filteredDetections.length} detection{filteredDetections.length !== 1 ? 's' : ''}
          {selectedCamera !== 'all' && ` from ${cameras.find(c => c.id === selectedCamera)?.name}`}
        </Typography>
      </Box>

      {/* Detections Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filteredDetections.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No detections found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Try adjusting your filters or date range
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filteredDetections.map((detection) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={detection.id}>
              <Card sx={{ cursor: 'pointer' }} onClick={() => handleViewDetail(detection)}>
                <CardMedia
                  component="img"
                  height="180"
                  image={api.getDetectionSnapshotUrl(detection.id)}
                  alt={detection.label}
                  sx={{ bgcolor: '#000' }}
                  onError={(e: any) => {
                    e.target.style.display = 'none';
                  }}
                />
                <CardContent sx={{ pb: 1 }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="h6" noWrap sx={{ flex: 1, textTransform: 'capitalize' }}>
                      {detection.label}
                    </Typography>
                    <Chip
                      label={`${Math.round(detection.confidence * 100)}%`}
                      size="small"
                      color={getConfidenceColor(detection.confidence) as any}
                    />
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {detection.cameraName}
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    {format(new Date(detection.detectedAt), 'MMM dd, yyyy HH:mm:ss')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={detailDialog}
        onClose={() => setDetailDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
              {selectedDetection?.label} Detection
            </Typography>
            <IconButton onClick={() => setDetailDialog(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedDetection && (
            <Box>
              <img
                src={api.getDetectionSnapshotUrl(selectedDetection.id)}
                alt={selectedDetection.label}
                style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', backgroundColor: '#000' }}
                onError={(e: any) => {
                  e.target.style.display = 'none';
                }}
              />

              <Box sx={{ mt: 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Camera
                    </Typography>
                    <Typography variant="body1">
                      {selectedDetection.cameraName}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Detection Time
                    </Typography>
                    <Typography variant="body1">
                      {format(new Date(selectedDetection.detectedAt), 'PPpp')}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Type
                    </Typography>
                    <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                      {selectedDetection.type}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Confidence
                    </Typography>
                    <Typography variant="body1">
                      {Math.round(selectedDetection.confidence * 100)}%
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Label
                    </Typography>
                    <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                      {selectedDetection.label}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default Detections;
