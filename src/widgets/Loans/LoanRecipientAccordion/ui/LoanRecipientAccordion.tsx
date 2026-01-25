import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  TableContainer,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { LoanGroup } from 'entities/Expense';

export const LoanRecipientAccordion = ({ group }: { group: LoanGroup }) => {
  const { recipient, totalAmount, loans } = group;

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{ '&:before': { display: 'none' } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          variant="subtitle1"
          fontWeight="600"
        >
          {recipient} — <strong>{totalAmount.toLocaleString()} ₽</strong>
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <TableContainer
          component={Paper}
          sx={{ boxShadow: 'none', border: '1px solid #eee' }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Дата</TableCell>
                <TableCell>Сумма</TableCell>
                <TableCell>Название</TableCell>
                <TableCell>Комментарий</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loans.map((loan, idx) => (
                <TableRow key={loan._id || idx}>
                  <TableCell>
                    {new Date(loan.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{loan.amount.toLocaleString()}</TableCell>
                  <TableCell>{loan.title}</TableCell>
                  <TableCell>{loan.comment || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </AccordionDetails>
    </Accordion>
  );
};
