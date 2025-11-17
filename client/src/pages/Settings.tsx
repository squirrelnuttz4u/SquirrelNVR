import React from 'react';
import Layout from '../components/Layout';
import { Typography } from '@mui/material';

const Settings: React.FC = () => {
  return (
    <Layout title="Settings">
      <Typography>System Settings - Configure storage, email, and system settings</Typography>
    </Layout>
  );
};

export default Settings;
