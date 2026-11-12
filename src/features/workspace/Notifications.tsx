import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { NotificationRecord } from '../../domain/types';
import { useAction, useApi } from '../../services/useApi';
import { apiRequest } from '../../services/apiClient';
import { Feedback, date } from '../purchase/shared';

export function Notifications({ close }: { close: () => void }) {
  const result = useApi<NotificationRecord[]>('notifications');
  const action = useAction();
  useEffect(() => {
    const refresh = () => result.reload();
    window.addEventListener('business-updated', refresh);
    return () => window.removeEventListener('business-updated', refresh);
  }, [result.reload]);
  return <Feedback {...result} retry={result.reload}><Feedback error={action.error} />{result.data?.length ? <ul className="activity-list">{result.data.slice().reverse().map(item => <li key={item.id}><Link className={`notification-link ${item.readAt ? '' : 'unread'}`} to={item.targetPath} onClick={event => { event.preventDefault(); void action.run(async () => { await apiRequest(`notifications/${item.id}`, { method: 'PATCH' }); close(); window.dispatchEvent(new CustomEvent('notification-navigate', { detail: item.targetPath })); }); }}>{item.text}</Link><small>{date(item.createdAt)} · {item.readAt ? 'Lue' : 'Non lue'}</small></li>)}</ul> : <p>Vous n’avez aucune notification.</p>}</Feedback>;
}
