import { useState } from 'react';
import { Button, Dialog, PageHeading } from '../../components/ui';
import { apiRequest } from '../../services/apiClient';
import { useAction, useApi } from '../../services/useApi';
import type { ActivityEvent } from '../../domain/types';
import { date, Feedback } from '../purchase/shared';

export function TechnicalPage() {
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const action = useAction();
  const emails = useApi<ActivityEvent[]>('demo/emails');
  return <><PageHeading eyebrow="Outils techniques" title="Pilotage des essais" description="Contrôles locaux de démonstration, séparés des écrans métier." /><section className="panel purchase-panel"><h2>Données de démonstration</h2><p>La réinitialisation restaure le jeu initial complet. Elle conserve la session et les données des autres applications.</p><div className="action-row"><Button variant="danger" onClick={() => setConfirm(true)} disabled={action.pending}>Réinitialiser les données</Button><Button disabled={action.pending} onClick={() => void action.run(async () => { await apiRequest('demo/force-error', { method: 'POST' }); setMessage('La prochaine requête API échouera une seule fois. Ouvrez la page à tester.'); })}>Forcer une erreur sur la prochaine requête</Button></div>{message && <p role="status">{message}</p>}<Feedback error={action.error} /></section><section className="panel purchase-panel"><h2>Journal des e-mails fictifs</h2><Feedback {...emails} retry={emails.reload}><ul className="activity-list">{emails.data?.slice().reverse().map(email => <li key={email.id}><h3>{email.subject}</h3><p>{email.body}</p><small>{email.recipientUserId} · {date(email.createdAt)}</small></li>)}</ul></Feedback></section><Dialog open={confirm} onClose={() => { if (!action.pending) setConfirm(false); }} title="Réinitialiser les données ?"><p>Les modifications des offres, commandes, paiements et messages seront remplacées par le jeu initial.</p><Button variant="danger" disabled={action.pending} onClick={() => void action.run(async () => { await apiRequest('demo/reset', { method: 'POST', body: JSON.stringify({ confirm: true }) }); setConfirm(false); setMessage('Le jeu initial a été restauré.'); emails.reload(); })}>Confirmer la réinitialisation</Button><Feedback error={action.error} /></Dialog></>;
}
