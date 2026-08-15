import React from 'react';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Paper from '@mui/material/Paper';

export interface ViewSkeletonProps {
  type?: 'dashboard' | 'table' | 'cards' | 'chart' | 'settings' | 'general';
}

export const ViewSkeleton: React.FC<ViewSkeletonProps> = ({ type = 'general' }) => {
  return (
    <Box sx={{ width: '100%', p: { xs: 1.5, sm: 2.5, md: 3 }, maxWidth: 1280, mx: 'auto' }}>
      {/* Header skeleton */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width={220} height={38} sx={{ borderRadius: 1.5, mb: 0.5 }} />
          <Skeleton variant="text" width={160} height={20} sx={{ borderRadius: 1 }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Skeleton variant="rounded" width={90} height={36} sx={{ borderRadius: '10px' }} />
          <Skeleton variant="rounded" width={110} height={36} sx={{ borderRadius: '10px' }} />
        </Box>
      </Box>

      {/* Summary KPI cards row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        {[1, 2, 3, 4].map(k => (
          <Paper
            key={k}
            elevation={0}
            sx={{
              p: 2,
              borderRadius: '16px',
              border: '1px solid var(--border)',
              bgcolor: 'var(--surface)',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Skeleton variant="text" width="60%" height={18} />
              <Skeleton variant="circular" width={28} height={28} />
            </Box>
            <Skeleton variant="text" width="80%" height={32} sx={{ mb: 0.5 }} />
            <Skeleton variant="text" width="45%" height={14} />
          </Paper>
        ))}
      </Box>

      {/* Dynamic Content Skeleton depending on type */}
      {type === 'chart' ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 2.5 }}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '16px',
              border: '1px solid var(--border)',
              bgcolor: 'var(--surface)',
              height: 380,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Skeleton variant="text" width={180} height={24} />
              <Skeleton variant="rounded" width={120} height={28} sx={{ borderRadius: 1 }} />
            </Box>
            <Skeleton variant="rounded" width="100%" height={280} sx={{ borderRadius: 2 }} />
          </Paper>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '16px',
              border: '1px solid var(--border)',
              bgcolor: 'var(--surface)',
              height: 380,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Skeleton variant="circular" width={220} height={220} sx={{ mb: 2 }} />
            <Skeleton variant="text" width={140} height={20} />
          </Paper>
        </Box>
      ) : type === 'settings' ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[1, 2, 3].map(k => (
            <Paper
              key={k}
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: '1px solid var(--border)',
                bgcolor: 'var(--surface)',
              }}
            >
              <Skeleton variant="text" width={200} height={26} sx={{ mb: 1.5 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Skeleton variant="rounded" width="100%" height={48} sx={{ borderRadius: 1.5 }} />
                <Skeleton variant="rounded" width="100%" height={48} sx={{ borderRadius: 1.5 }} />
              </Box>
            </Paper>
          ))}
        </Box>
      ) : (
        /* Main table / list card skeleton */
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: '16px',
            border: '1px solid var(--border)',
            bgcolor: 'var(--surface)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Skeleton variant="text" width={160} height={24} />
            <Skeleton variant="rounded" width={200} height={34} sx={{ borderRadius: 2 }} />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 1.2,
                  px: 1.5,
                  borderRadius: '12px',
                  bgcolor: 'var(--surface2)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                  <Skeleton variant="rounded" width={38} height={38} sx={{ borderRadius: '10px' }} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="40%" height={20} />
                    <Skeleton variant="text" width="25%" height={14} />
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: 100 }}>
                  <Skeleton variant="text" width="70%" height={20} />
                  <Skeleton variant="text" width="40%" height={14} />
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default ViewSkeleton;
