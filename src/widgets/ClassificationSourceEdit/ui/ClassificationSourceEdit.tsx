import {Alert,Button,Typography} from '@mui/material';
import {skipToken} from '@reduxjs/toolkit/query';
import {useVerifiedOwner} from 'entities/User/model/useVerifiedOwner';
import {Modal} from 'shared/ui/Modal';
import {readSourceEditTarget,type SourceEditTarget} from 'features/HistoricalClassification/model/sourceEdit';
import {useReadSourceForEditQuery} from 'features/HistoricalClassification/api/sourceEditApi';
import {EditExpenseModal} from 'widgets/Modals/EditExpenseModal';
import {EditIncomeModal} from 'widgets/Modals/EditIncomeModal';

export const ClassificationSourceEdit=({target,onClose}:{target:SourceEditTarget;onClose:()=>void})=>{
 const owner=useVerifiedOwner(),checked=readSourceEditTarget(target);
 const authorized=checked&&owner.status==='verified'&&checked.ownerId===owner.owner.userId&&checked.sessionGeneration===owner.owner.sessionGeneration;
 const query=useReadSourceForEditQuery(authorized?checked:skipToken,{refetchOnMountOrArgChange:true});
 if(!authorized||query.isError||query.isFetching||!query.currentData)return <Modal open title="Редактировать операцию" onClose={onClose}>
  {!authorized?<Alert severity="warning">Редактирование недоступно: проверьте текущую сессию владельца и откройте операцию заново.</Alert>
   :query.isError?<Alert severity="error">Не удалось получить выбранную операцию. Она недоступна, удалена или изменилась. Пустая форма не открыта.</Alert>
   :<Typography role="status">Загрузка выбранной операции…</Typography>}
  <Button onClick={onClose}>Закрыть</Button>
 </Modal>;
 const {operationId,dataset,facts}=query.currentData;
 const common={_id:operationId,amount:facts.amount,date:facts.date,comment:facts.comment??''};
 return dataset==='expenses'
  ?<EditExpenseModal open expenseId={operationId} initialExpense={{...common,title:facts.title!,category:facts.category!,recipient:facts.recipient!}} onClose={onClose}/>
  :<EditIncomeModal open incomeId={operationId} initialIncome={{...common,source:facts.source!}} onClose={onClose}/>;
};
