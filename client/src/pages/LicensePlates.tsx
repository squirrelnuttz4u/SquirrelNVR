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
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Close,
  Search as SearchIcon,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';
import { format } from 'date-fns';

interface LicensePlate {
  id: string;
  cameraId: string;
  cameraName: string;
  plateNumber: string;
  confidence: number;
  snapshotPath: string;
  detectedAt: Date;
}

interface Camera {
  id: string;
  name: string;
}

const LicensePlates: React.FC = () => {
  const [plates, setPlates] = useState<LicensePlate[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCamera, setSelectedCamera] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
  );
  const [endDate, setEndDate] = useState<Date | null>(new Date());

  // Detail dialog
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedPlate, setSelectedPlate] = useState<LicensePlate | null>(null);

  // Grouped view
  const [groupedPlates, setGroupedPlates] = useState<Map<string, LicensePlate[]>>(new Map());

  useEffect(() => {
    loadCameras();
  }, []);

  useEffect(() => {
    loadPlates();
  }, [selectedCamera, startDate, endDate]);

  const loadCameras = async () => {
    try {
      const data = await api.getCameras();
      setCameras(data);
    } catch (error) {
      console.error('Failed to load cameras:', error);
    }
  };

  const loadPlates = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        sort: 'detectedAt:desc',
      };

      if (selectedCamera !== 'all') {
        params.cameraId = selectedCamera;
      }

      if (startDate) {
        params.startDate = startDate.toISOString();
      }

      if (endDate) {
        params.endDate = endDate.toISOString();
      }

      const data = await api.getLicensePlates(params);
      setPlates(data);

      // Group plates by plate number
      const grouped = new Map<string, LicensePlate[]>();
      data.forEach((plate: LicensePlate) => {
        const existing = grouped.get(plate.plateNumber) || [];
        grouped.set(plate.plateNumber, [...existing, plate]);
      });
      setGroupedPlates(grouped);
    } catch (error: any) {
      console.error('Failed to load license plates:', error);
      setError(error.response?.data?.error || 'Failed to load license plates');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadPlates();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.searchLicensePlates(searchQuery);
      setPlates(data);

      // Group plates by plate number
      const grouped = new Map<string, LicensePlate[]>();
      data.forEach((plate: LicensePlate) => {
        const existing = grouped.get(plate.plateNumber) || [];
        grouped.set(plate.plateNumber, [...existing, plate]);
      });
      setGroupedPlates(grouped);
    } catch (error: any) {
      console.error('Failed to search license plates:', error);
      setError(error.response?.data?.error || 'Failed to search license plates');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (plate: LicensePlate) => {
    setSelectedPlate(plate);
    setDetailDialog(true);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'success';
    if (confidence >= 0.7) return 'primary';
    if (confidence >= 0.5) return 'warning';
    return 'default';
  };

  return (
    <Layout title="License Plates">
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Search & Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Search Plate Number"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="ABC123"
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
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

            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleSearch}
              >
                Search
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Found {plates.length} detection{plates.length !== 1 ? 's' : ''} for {groupedPlates.size} unique plate{groupedPlates.size !== 1 ? 's' : ''}
          {selectedCamera !== 'all' && ` from ${cameras.find(c => c.id === selectedCamera)?.name}`}
        </Typography>
      </Box>

      {/* Grouped License Plates Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : groupedPlates.size === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No license plates found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Try adjusting your filters or search query
          </Typography>
        </Box>
      ) : (
        <TableContainer component={Card}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Plate Number</TableCell>
                <TableCell>Detections</TableCell>
                <TableCell>Cameras</TableCell>
                <TableCell>First Seen</TableCell>
                <TableCell>Last Seen</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.from(groupedPlates.entries()).map(([plateNumber, detections]) => {
                const sortedDetections = detections.sort(
                  (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
                );
                const firstSeen = sortedDetections[sortedDetections.length - 1];
                const lastSeen = sortedDetections[0];
                const uniqueCameras = new Set(detections.map((d) => d.cameraName));

                return (
                  <TableRow key={plateNumber}>
                    <TableCell>
                      <Typography variant="h6" component="span" sx={{ fontFamily: 'monospace' }}>
                        {plateNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={detections.length} size="small" color="primary" />
                    </TableCell>
                    <TableCell>
                      {Array.from(uniqueCameras).join(', ')}
                    </TableCell>
                    <TableCell>
                      {format(new Date(firstSeen.detectedAt), 'MMM dd, HH:mm')}
                    </TableCell>
                    <TableCell>
                      {format(new Date(lastSeen.detectedAt), 'MMM dd, HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleViewDetail(lastSeen)}
                      >
                        View Latest
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* All Detections Grid (below table) */}
      {plates.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
            All Detections
          </Typography>
          <Grid container spacing={2}>
            {plates.map((plate) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={plate.id}>
                <Card sx={{ cursor: 'pointer' }} onClick={() => handleViewDetail(plate)}>
                  <CardMedia
                    component="img"
                    height="180"
                    image={api.getDetectionSnapshotUrl(plate.id)}
                    alt={plate.plateNumber}
                    sx={{ bgcolor: '#000' }}
                    onError={(e: any) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <CardContent sx={{ pb: 1 }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                      <Typography variant="h6" noWrap sx={{ flex: 1, fontFamily: 'monospace' }}>
                        {plate.plateNumber}
                      </Typography>
                      <Chip
                        label={`${Math.round(plate.confidence * 100)}%`}
                        size="small"
                        color={getConfidenceColor(plate.confidence) as any}
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {plate.cameraName}
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      {format(new Date(plate.detectedAt), 'MMM dd, yyyy HH:mm:ss')}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
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
            <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
              {selectedPlate?.plateNumber}
            </Typography>
            <IconButton onClick={() => setDetailDialog(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedPlate && (
            <Box>
              <img
                src={api.getDetectionSnapshotUrl(selectedPlate.id)}
                alt={selectedPlate.plateNumber}
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
                      {selectedPlate.cameraName}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Detection Time
                    </Typography>
                    <Typography variant="body1">
                      {format(new Date(selectedPlate.detectedAt), 'PPpp')}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Plate Number
                    </Typography>
                    <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '1.2rem' }}>
                      {selectedPlate.plateNumber}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Confidence
                    </Typography>
                    <Typography variant="body1">
                      {Math.round(selectedPlate.confidence * 100)}%
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

export default LicensePlates;
