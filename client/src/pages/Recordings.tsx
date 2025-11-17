import React, { useEffect, useState } from 'react';
import {
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  Box,
  TextField,
  MenuItem,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  InputAdornment,
  CircularProgress,
  Alert,
  Checkbox,
  Slider,
  Snackbar,
} from '@mui/material';
import {
  PlayArrow,
  Delete,
  Download,
  Search,
  FilterList,
  Close,
  ContentCut,
  CheckBox,
  CheckBoxOutlineBlank,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';
import { format } from 'date-fns';

interface Recording {
  id: string;
  cameraId: string;
  cameraName: string;
  filePath: string;
  fileSize: number;
  duration: number;
  startTime: Date;
  endTime: Date;
  thumbnailPath?: string;
  recordingType: string;
  createdAt: Date;
}

interface Camera {
  id: string;
  name: string;
}

const Recordings: React.FC = () => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [selectedCamera, setSelectedCamera] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
  );
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [recordingType, setRecordingType] = useState<string>('all');

  // Playback dialog
  const [playbackDialog, setPlaybackDialog] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [recordingToDelete, setRecordingToDelete] = useState<Recording | null>(null);

  // Clip creation
  const [clipDialog, setClipDialog] = useState(false);
  const [clipStartTime, setClipStartTime] = useState(0);
  const [clipEndTime, setClipEndTime] = useState(0);
  const [clipRecording, setClipRecording] = useState<Recording | null>(null);

  // Batch operations
  const [selectedRecordings, setSelectedRecordings] = useState<Set<string>>(new Set());
  const [batchExporting, setBatchExporting] = useState(false);

  useEffect(() => {
    loadCameras();
  }, []);

  useEffect(() => {
    loadRecordings();
  }, [selectedCamera, startDate, endDate, recordingType]);

  const loadCameras = async () => {
    try {
      const data = await api.getCameras();
      setCameras(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load cameras:', error);
      setCameras([]);
    }
  };

  const loadRecordings = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        sort: 'startTime:desc',
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

      if (recordingType !== 'all') {
        params.type = recordingType;
      }

      const data = await api.getRecordings(params);
      setRecordings(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Failed to load recordings:', error);
      setError(error.response?.data?.error || 'Failed to load recordings. Make sure the backend server is running.');
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayback = (recording: Recording) => {
    setSelectedRecording(recording);
    setPlaybackDialog(true);
  };

  const handleDelete = async () => {
    if (!recordingToDelete) return;

    try {
      await api.deleteRecording(recordingToDelete.id);
      setRecordings((prev) => prev.filter((r) => r.id !== recordingToDelete.id));
      setDeleteDialog(false);
      setRecordingToDelete(null);
    } catch (error) {
      console.error('Failed to delete recording:', error);
      setError('Failed to delete recording');
    }
  };

  const handleDownload = (recording: Recording) => {
    const url = api.getRecordingVideoUrl(recording.id);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${recording.cameraName}_${format(
      new Date(recording.startTime),
      'yyyy-MM-dd_HH-mm-ss'
    )}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateClip = (recording: Recording) => {
    setClipRecording(recording);
    setClipStartTime(0);
    setClipEndTime(recording.duration);
    setClipDialog(true);
  };

  const handleSaveClip = () => {
    if (!clipRecording) return;

    // Create clip URL with time parameters
    const url = `${api.getRecordingVideoUrl(clipRecording.id)}?start=${clipStartTime}&end=${clipEndTime}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${clipRecording.cameraName}_clip_${format(
      new Date(clipRecording.startTime),
      'yyyy-MM-dd_HH-mm-ss'
    )}_${clipStartTime}s-${clipEndTime}s.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setClipDialog(false);
  };

  const handleToggleSelection = (id: string) => {
    const newSelection = new Set(selectedRecordings);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedRecordings(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedRecordings.size === filteredRecordings.length) {
      setSelectedRecordings(new Set());
    } else {
      setSelectedRecordings(new Set(filteredRecordings.map((r) => r.id)));
    }
  };

  const handleBatchExport = async () => {
    if (selectedRecordings.size === 0) return;

    setBatchExporting(true);
    try {
      // Download each selected recording
      for (const id of Array.from(selectedRecordings)) {
        const recording = recordings.find((r) => r.id === id);
        if (recording) {
          await new Promise((resolve) => {
            handleDownload(recording);
            // Small delay between downloads
            setTimeout(resolve, 500);
          });
        }
      }
      setSuccess(`Exported ${selectedRecordings.size} recording(s)`);
      setSelectedRecordings(new Set());
    } catch (error) {
      console.error('Failed to export recordings:', error);
      setError('Failed to export some recordings');
    } finally {
      setBatchExporting(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRecordings.size === 0) return;

    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedRecordings.size} recording(s)? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      // Delete each selected recording
      for (const id of Array.from(selectedRecordings)) {
        await api.deleteRecording(id);
      }
      setRecordings((prev) => prev.filter((r) => !selectedRecordings.has(r.id)));
      setSuccess(`Deleted ${selectedRecordings.size} recording(s)`);
      setSelectedRecordings(new Set());
    } catch (error) {
      console.error('Failed to delete recordings:', error);
      setError('Failed to delete some recordings');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getRecordingTypeColor = (type: string) => {
    switch (type) {
      case 'continuous':
        return 'primary';
      case 'motion':
        return 'warning';
      case 'ai':
        return 'secondary';
      case 'manual':
        return 'info';
      default:
        return 'default';
    }
  };

  const filteredRecordings = recordings.filter((recording) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        recording.cameraName.toLowerCase().includes(query) ||
        recording.recordingType.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <Layout title="Recordings">
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
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
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
                  value={recordingType}
                  onChange={(e) => setRecordingType(e.target.value)}
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="continuous">Continuous</MenuItem>
                  <MenuItem value="motion">Motion</MenuItem>
                  <MenuItem value="ai">AI Detection</MenuItem>
                  <MenuItem value="manual">Manual</MenuItem>
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
                  startIcon={<FilterList />}
                  onClick={loadRecordings}
                >
                  Apply
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Results Summary & Batch Actions */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="body2" color="text.secondary">
              Found {filteredRecordings.length} recording{filteredRecordings.length !== 1 ? 's' : ''}
              {selectedCamera !== 'all' && ` from ${cameras.find(c => c.id === selectedCamera)?.name}`}
            </Typography>
            {filteredRecordings.length > 0 && (
              <Button
                size="small"
                onClick={handleSelectAll}
                startIcon={selectedRecordings.size === filteredRecordings.length ? <CheckBox /> : <CheckBoxOutlineBlank />}
              >
                {selectedRecordings.size === filteredRecordings.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </Box>

          <Box display="flex" gap={1}>
            {selectedRecordings.size > 0 && (
              <>
                <Chip
                  label={`${selectedRecordings.size} selected`}
                  color="primary"
                  size="small"
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleBatchExport}
                  disabled={batchExporting}
                  startIcon={<Download />}
                >
                  Export Selected
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={handleBatchDelete}
                  startIcon={<Delete />}
                >
                  Delete Selected
                </Button>
              </>
            )}
            <Button size="small" onClick={loadRecordings} startIcon={<Search />}>
              Refresh
            </Button>
          </Box>
        </Box>

        {/* Recordings Grid */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : filteredRecordings.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary">
              No recordings found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Try adjusting your filters or date range
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {filteredRecordings.map((recording) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={recording.id}>
                <Card sx={{ position: 'relative' }}>
                  <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}>
                    <Checkbox
                      checked={selectedRecordings.has(recording.id)}
                      onChange={() => handleToggleSelection(recording.id)}
                      sx={{
                        color: 'white',
                        bgcolor: 'rgba(0,0,0,0.5)',
                        '&.Mui-checked': {
                          color: 'primary.main',
                          bgcolor: 'rgba(255,255,255,0.9)',
                        },
                      }}
                    />
                  </Box>
                  <CardMedia
                    component="img"
                    height="180"
                    image={
                      recording.thumbnailPath
                        ? api.getRecordingThumbnailUrl(recording.id)
                        : '/placeholder-video.png'
                    }
                    alt={recording.cameraName}
                    sx={{ cursor: 'pointer', bgcolor: '#000' }}
                    onClick={() => handlePlayback(recording)}
                  />
                  <CardContent sx={{ pb: 1 }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                      <Typography variant="h6" noWrap sx={{ flex: 1 }}>
                        {recording.cameraName}
                      </Typography>
                      <Chip
                        label={recording.recordingType}
                        size="small"
                        color={getRecordingTypeColor(recording.recordingType)}
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {format(new Date(recording.startTime), 'MMM dd, yyyy HH:mm')}
                    </Typography>

                    <Box display="flex" justifyContent="space-between" mt={1}>
                      <Typography variant="caption" color="text.secondary">
                        {formatDuration(recording.duration)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(recording.fileSize)}
                      </Typography>
                    </Box>
                  </CardContent>

                  <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
                    <Box>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handlePlayback(recording)}
                        title="Play"
                      >
                        <PlayArrow />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleDownload(recording)}
                        title="Download"
                      >
                        <Download />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="secondary"
                        onClick={() => handleCreateClip(recording)}
                        title="Create Clip"
                      >
                        <ContentCut />
                      </IconButton>
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        setRecordingToDelete(recording);
                        setDeleteDialog(true);
                      }}
                      title="Delete"
                    >
                      <Delete />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Playback Dialog */}
        <Dialog
          open={playbackDialog}
          onClose={() => setPlaybackDialog(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">
                {selectedRecording?.cameraName} - Recording Playback
              </Typography>
              <IconButton onClick={() => setPlaybackDialog(false)}>
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            {selectedRecording && (
              <Box>
                <video
                  controls
                  autoPlay
                  style={{ width: '100%', maxHeight: '70vh', backgroundColor: '#000' }}
                  src={api.getRecordingVideoUrl(selectedRecording.id)}
                >
                  Your browser does not support video playback.
                </video>

                <Box sx={{ mt: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Start Time
                      </Typography>
                      <Typography variant="body1">
                        {format(new Date(selectedRecording.startTime), 'PPpp')}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        End Time
                      </Typography>
                      <Typography variant="body1">
                        {format(new Date(selectedRecording.endTime), 'PPpp')}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Duration
                      </Typography>
                      <Typography variant="body1">
                        {formatDuration(selectedRecording.duration)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        File Size
                      </Typography>
                      <Typography variant="body1">
                        {formatFileSize(selectedRecording.fileSize)}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => handleDownload(selectedRecording!)} startIcon={<Download />}>
              Download
            </Button>
            <Button onClick={() => setPlaybackDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
          <DialogTitle>Delete Recording</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this recording from{' '}
              <strong>{recordingToDelete?.cameraName}</strong>?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
            <Button onClick={handleDelete} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Clip Creation Dialog */}
        <Dialog
          open={clipDialog}
          onClose={() => setClipDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Create Clip</Typography>
              <IconButton onClick={() => setClipDialog(false)}>
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            {clipRecording && (
              <Box>
                <Typography variant="body1" gutterBottom>
                  <strong>Camera:</strong> {clipRecording.cameraName}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Recording:</strong>{' '}
                  {format(new Date(clipRecording.startTime), 'PPpp')}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
                  <strong>Duration:</strong> {formatDuration(clipRecording.duration)}
                </Typography>

                <Box sx={{ mt: 4, mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Start Time: {formatDuration(clipStartTime)}
                  </Typography>
                  <Slider
                    value={clipStartTime}
                    onChange={(_, value) => setClipStartTime(value as number)}
                    min={0}
                    max={clipRecording.duration}
                    step={1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => formatDuration(value)}
                  />
                </Box>

                <Box sx={{ mt: 3, mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    End Time: {formatDuration(clipEndTime)}
                  </Typography>
                  <Slider
                    value={clipEndTime}
                    onChange={(_, value) => setClipEndTime(value as number)}
                    min={clipStartTime + 1}
                    max={clipRecording.duration}
                    step={1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => formatDuration(value)}
                  />
                </Box>

                <Alert severity="info" sx={{ mt: 3 }}>
                  Clip Duration: {formatDuration(clipEndTime - clipStartTime)}
                  <br />
                  Estimated Size:{' '}
                  {formatFileSize(
                    (clipRecording.fileSize / clipRecording.duration) *
                      (clipEndTime - clipStartTime)
                  )}
                </Alert>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setClipDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSaveClip}
              variant="contained"
              startIcon={<ContentCut />}
              disabled={clipEndTime <= clipStartTime}
            >
              Create & Download Clip
            </Button>
          </DialogActions>
        </Dialog>

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

export default Recordings;
