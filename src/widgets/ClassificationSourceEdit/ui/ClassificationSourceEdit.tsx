import {Alert,Button,Stack,Typography} from '@mui/material';
import {useLocation,useNavigate} from 'react-router';
import {skipToken} from '@reduxjs/toolkit/query';
import {useVerifiedOwner} from 'entities/User/model/useVerifiedOwner';
import {readSourceEditTarget} from 'features/HistoricalClassification/model/sourceEdit';
import {useReadSourceForEditQuery} from 'features/HistoricalClassification/api/sourceEditApi';
import {EditExpenseModal} from 'widgets/Modals/EditExpenseModal';
import {EditIncomeModal} from 'widgets/Modals/EditIncomeModal';

export const ClassificationSourceEdit=({dataset}:{dataset:'expenses'|'incomes'})=>{
 const location=useLocation(),navigate=useNavigate(),owner=useVerifiedOwner();
 const target=readSourceEditTarget(location.state);
 const authorized=target&&target.dataset===dataset&&owner.status==='verified'&&target.ownerId===owner.owner.userId&&target.sessionGeneration===owner.owner.sessionGeneration;
 const query=useReadSourceForEditQuery(authorized?target:skipToken,{refetchOnMountOrArgChange:true});
 if(!location.state)return null;
 // Other established page navigation state is not an edit request.
 if(!target&&!(typeof location.state==='object'&&location.state?.kind==='classification-source-edit-v1'))return null;
 const back=()=>navigate('/analytics/classification'+(target?.returnSearch??''),{replace:true});
 const returnButton=<Button onClick={back}>Вернуться к классификации</Button>;
 if(!authorized)return <Stack><Alert severity="warning">Редактирование недоступно: проверьте текущую сессию владельца и откройте операцию заново.</Alert>{returnButton}</Stack>;
 if(query.isError)return <Stack><Alert severity="error">Не удалось получить выбранную операцию. Она недоступна, удалена или изменилась. Пустая форма не открыта.</Alert>{returnButton}</Stack>;
 if(query.isFetching||!query.currentData)return <Stack><Typography role="status">Загрузка выбранной операции…</Typography>{returnButton}</Stack>;
 const {operationId,facts}=query.currentData;
 const common={_id:operationId,amount:facts.amount,date:facts.date,comment:facts.comment??''};
 return <>
  {returnButton}
  {dataset==='expenses'
   ?<EditExpenseModal key={location.key} open expenseId={operationId} initialExpense={{...common,title:facts.title!,category:facts.category!,recipient:facts.recipient!}} onClose={back}/>
   :<EditIncomeModal key={location.key} open incomeId={operationId} initialIncome={{...common,source:facts.source!}} onClose={back}/>}
 </>;
};
