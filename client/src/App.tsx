import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LiveView from './pages/LiveView';
import Cameras from './pages/Cameras';
import Recordings from './pages/Recordings';
import Detections from './pages/Detections';
import LicensePlates from './pages/LicensePlates';
import Alarms from './pages/Alarms';
import Settings from './pages/Settings';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#0a1929',
      paper: '#132f4c',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
});

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/live"
        element={
          <PrivateRoute>
            <LiveView />
          </PrivateRoute>
        }
      />
      <Route
        path="/cameras"
        element={
          <PrivateRoute>
            <Cameras />
          </PrivateRoute>
        }
      />
      <Route
        path="/recordings"
        element={
          <PrivateRoute>
            <Recordings />
          </PrivateRoute>
        }
      />
      <Route
        path="/detections"
        element={
          <PrivateRoute>
            <Detections />
          </PrivateRoute>
        }
      />
      <Route
        path="/license-plates"
        element={
          <PrivateRoute>
            <LicensePlates />
          </PrivateRoute>
        }
      />
      <Route
        path="/alarms"
        element={
          <PrivateRoute>
            <Alarms />
          </PrivateRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <PrivateRoute>
            <Settings />
          </PrivateRoute>
        }
      />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <AuthProvider>
          <WebSocketProvider>
            <Router>
              <AppRoutes />
            </Router>
          </WebSocketProvider>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
};

export default App;
