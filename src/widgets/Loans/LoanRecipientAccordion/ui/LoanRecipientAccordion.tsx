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
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { LoanGroup } from 'entities/Expense';
import { LoanOperationRow } from 'widgets/Loans/LoanOperationRow';

interface LoanRecipientAccordionProps {
  group: LoanGroup;
}

export const LoanRecipientAccordion = ({
  group,
}: LoanRecipientAccordionProps) => {
  const { recipient, totalAmount, operations } = group;
  const isDebtClosed = totalAmount <= 0;

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        '&:before': { display: 'none' },
        border: '1px solid #eee',
        borderRadius: 1,
        mb: 1,
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          variant="subtitle1"
          fontWeight="600"
        >
          {recipient}
          {' — '}
          <Typography
            component="span"
            color={isDebtClosed ? 'success.main' : 'error.main'}
            fontWeight="700"
          >
            {totalAmount.toLocaleString()} ₽
          </Typography>
          {isDebtClosed && (
            <Chip
              label="Закрыт"
              color="success"
              size="small"
              sx={{ ml: 1, height: 20 }}
            />
          )}
        </Typography>
      </AccordionSummary>

      <AccordionDetails>
        <TableContainer
          component={Paper}
          sx={{ boxShadow: 'none' }}
        >
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                <TableCell>Дата</TableCell>
                <TableCell>Тип</TableCell>
                <TableCell>Сумма</TableCell>
                <TableCell>Название</TableCell>
                <TableCell>Комментарий</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {operations.map((op, idx) => (
                <LoanOperationRow
                  key={op._id}
                  operation={op}
                  index={idx}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </AccordionDetails>
    </Accordion>
  );
};
