import { Box, Paper, Typography } from '@mui/material';
import type { ReviewEntry } from '../model/reviewSession';

export const ClassificationReviewSummary = ({ entries }: { entries: readonly ReviewEntry[] }) => {
  const items = [
    ['Всего операций', entries.length],
    ['Ожидают классификации', entries.filter((entry) => entry.resolution.state === 'unclassified' || entry.resolution.state === 'proposed').length],
    ['Подтверждены вручную', entries.filter((entry) => entry.resolution.state === 'approved').length],
    ['Явно без классификации', entries.filter((entry) => entry.resolution.state === 'explicit_unclassified').length],
  ] as const;
  return <Paper component="section" aria-label="Обзор классификации" variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
    <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
      {items.map(([label, count]) => <Box key={label} sx={{ minWidth: 0 }}>
        <Typography component="dt" variant="body2" color="text.secondary">{label}</Typography>
        <Typography component="dd" variant="h5" sx={{ m: 0, mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>{count}</Typography>
      </Box>)}
    </Box>
  </Paper>;
};
