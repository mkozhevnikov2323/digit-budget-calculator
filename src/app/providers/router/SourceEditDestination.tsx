import {lazy} from 'react';
import {useLocation} from 'react-router';
const ClassificationSourceEdit = lazy(() => import('widgets/ClassificationSourceEdit/ui/ClassificationSourceEdit').then(m => ({default:m.ClassificationSourceEdit})));
// Normal financial pages do not load the editor bridge or its queries.
export const SourceEditDestination=({dataset}:{dataset:'expenses'|'incomes'})=>{
  const {state}=useLocation();
  return state && typeof state==='object' && state.kind==='classification-source-edit-v1'
    ? <ClassificationSourceEdit dataset={dataset}/> : null;
};
