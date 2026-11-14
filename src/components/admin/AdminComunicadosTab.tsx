// Comunicados por push e na central de notificações: envio (superadministrador), agendamento,
// segmentação e histórico com o resultado (entregues, lidos, falhas).
import React, { useEffect, useState } from 'react';
import { Megaphone, Send, CalendarClock, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AUDIENCE_LABEL, cancelBroadcast, createBroadcast, fetchBroadcastHistory, type BroadcastAudience, type BroadcastDraft, type BroadcastRecord } from '../../lib/adminPainel';
import { askConfirm, askText, notify } from '../common/Feedback';
import { Seletor } from '../common/Seletor';

const VAZIO: BroadcastDraft = { title: '', body: '', audience: 'all', ref: null, link: '', when: null, justification: '' };
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export const AdminComunicadosTab: React.FC = () => {
  const { adminRole, events, communities } = useApp();
  const podeEnviar = adminRole === 'superadmin';
  const [d, setD] = useState<BroadcastDraft>(VAZIO);
  const [agendar, setAgendar] = useState(false);
  const [historico, setHistorico] = useState<BroadcastRecord[]>([]);
  const [enviando, setEnviando] = useState(false);
  const muda = (p: Partial<BroadcastDraft>) => setD(prev => ({ ...prev, ...p }));

  const carregar = async () => setHistorico(await fetchBroadcastHistory());
  useEffect(() => { carregar(); }, []);

  const eventosAbertos = events.filter(e => e.status === 'approved' && new Date(e.endsAt ?? e.startsAt) >= new Date());
  const precisaRef = d.audience === 'event' || d.audience === 'community';

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (precisaRef && !d.ref) { notify('Escolha o evento ou a comunidade.'); return; }
    const publico = AUDIENCE_LABEL[d.audience].toLowerCase();
    if (!(await askConfirm({ title: agendar ? 'Agendar comunicado?' : 'Enviar comunicado agora?', message: `Vai para: ${publico}. Quem silenciou comunicados nas preferências não recebe o push.`, confirmLabel: agendar ? 'Agendar' : 'Enviar' }))) return;
    setEnviando(true);
    const error = await createBroadcast({ ...d, when: agendar ? d.when : null, link: d.link?.trim() || null });
    setEnviando(false);
    if (error) { notify(error); return; }
    notify(agendar ? 'Comunicado agendado.' : 'Comunicado enviado.');
    setD(VAZIO); setAgendar(false);
    carregar();
  };

  const cancelar = async (b: BroadcastRecord) => {
    const motivo = await askText({ title: 'Cancelar comunicado agendado?', message: b.title, placeholder: 'Justificativa', confirmLabel: 'Cancelar envio' });
    if (motivo === null) return;
    const error = await cancelBroadcast(b.id, motivo);
    if (error) notify(error); else carregar();
  };

  const campo = 'w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60';
  const destinoSugerido = d.audience === 'event' && d.ref ? `/eventos/${d.ref}` : d.audience === 'community' && d.ref ? `/comunidades/${d.ref}` : '';

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
      <section className="p-5 rounded-3xl bg-painel border border-amber-900/30 h-fit">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-1"><Megaphone className="w-4 h-4 text-amber-300" /> Novo comunicado</h2>
        <p className="text-[12px] text-zinc-400 mb-4">Chega como push (para quem ativou) e fica na central de notificações. Fica registrado na auditoria.</p>
        {!podeEnviar ? (
          <p className="text-xs text-zinc-400 p-3 rounded-xl bg-zinc-950 border border-zinc-800">Somente o superadministrador envia comunicados. Você pode acompanhar o histórico ao lado.</p>
        ) : (
          <form onSubmit={enviar} className="space-y-3">
            <label className="block">
              <span className="block text-[12px] font-bold text-zinc-400 mb-1">Título ({d.title.length}/80)</span>
              <input required minLength={3} maxLength={80} value={d.title} onChange={e => muda({ title: e.target.value })} className={campo} placeholder="Ex.: Novidade no Vybelog" />
            </label>
            <label className="block">
              <span className="block text-[12px] font-bold text-zinc-400 mb-1">Mensagem ({d.body.length}/300)</span>
              <textarea required minLength={3} maxLength={300} rows={3} value={d.body} onChange={e => muda({ body: e.target.value })} className={campo} />
            </label>
            <label className="block">
              <span className="block text-[12px] font-bold text-zinc-400 mb-1">Público</span>
              <Seletor value={d.audience} onChange={e => muda({ audience: e.target.value as BroadcastAudience, ref: null })} className={campo}>
                {(Object.keys(AUDIENCE_LABEL) as BroadcastAudience[]).map(a => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}
              </Seletor>
            </label>
            {d.audience === 'event' && (
              <Seletor required value={d.ref ?? ''} onChange={e => muda({ ref: e.target.value || null })} className={campo} aria-label="Evento">
                <option value="">Escolha o evento</option>
                {eventosAbertos.map(ev => <option key={ev.id} value={ev.id}>{ev.title} · {ev.city}</option>)}
              </Seletor>
            )}
            {d.audience === 'community' && (
              <Seletor required value={d.ref ?? ''} onChange={e => muda({ ref: e.target.value || null })} className={campo} aria-label="Comunidade">
                <option value="">Escolha a comunidade</option>
                {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Seletor>
            )}
            <label className="block">
              <span className="block text-[12px] font-bold text-zinc-400 mb-1">Ao tocar, abrir (opcional)</span>
              <input value={d.link ?? ''} onChange={e => muda({ link: e.target.value })} pattern="/[a-z0-9/_\-]*" className={campo} placeholder={destinoSugerido || '/eventos'} />
              {destinoSugerido && !d.link && (
                <button type="button" onClick={() => muda({ link: destinoSugerido })} className="mt-1 text-[12px] text-amber-300 cursor-pointer">Usar {destinoSugerido}</button>
              )}
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={agendar} onChange={e => setAgendar(e.target.checked)} className="accent-amber-500" /> Agendar envio
            </label>
            {agendar && (
              <input type="datetime-local" required value={d.when ?? ''} min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                onChange={e => muda({ when: e.target.value })} className={campo} aria-label="Data e hora do envio" />
            )}
            <label className="block">
              <span className="block text-[12px] font-bold text-zinc-400 mb-1">Justificativa (auditoria)</span>
              <input required minLength={5} value={d.justification} onChange={e => muda({ justification: e.target.value })} className={campo} placeholder="Motivo do comunicado" />
            </label>
            <button type="submit" disabled={enviando} className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
              {agendar ? <CalendarClock className="w-4 h-4" /> : <Send className="w-4 h-4" />} {enviando ? 'Enviando…' : agendar ? 'Agendar' : 'Enviar agora'}
            </button>
          </form>
        )}
      </section>

      <section className="p-5 rounded-3xl bg-painel border border-purple-900/30">
        <h2 className="text-sm font-bold text-white mb-3">Histórico</h2>
        {historico.length === 0 ? <p className="text-xs text-zinc-500 py-6 text-center">Nenhum comunicado ainda.</p> : (
          <ul className="space-y-2.5">
            {historico.map(b => {
              const situacao = b.cancelled_at ? 'Cancelado' : b.sent_at ? 'Enviado' : 'Agendado';
              return (
                <li key={b.id} className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-100">{b.title}</p>
                      <p className="text-[12px] text-zinc-400 line-clamp-2">{b.body}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${b.cancelled_at ? 'bg-zinc-800 text-zinc-400' : b.sent_at ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'}`}>{situacao}</span>
                  </div>
                  <p className="mt-2 text-[12px] text-zinc-500 tabular-nums">
                    {AUDIENCE_LABEL[b.audience] ?? b.audience} · {b.sent_at ? `enviado ${quando(b.sent_at)}` : `para ${quando(b.scheduled_at)}`}
                  </p>
                  {b.sent_at && (
                    <p className="mt-1 text-[12px] text-zinc-300 tabular-nums">
                      {b.recipients ?? 0} destinatários · {b.read_count} leram · {b.push_sent} push entregues
                      {b.push_failed > 0 && <span className="text-rose-300"> · {b.push_failed} falhas</span>}
                      {b.push_pending > 0 && <span className="text-amber-300"> · {b.push_pending} na fila</span>}
                    </p>
                  )}
                  {!b.sent_at && !b.cancelled_at && podeEnviar && (
                    <button type="button" onClick={() => cancelar(b)} className="mt-2 text-[12px] font-semibold text-rose-300 flex items-center gap-1 cursor-pointer"><XCircle className="w-3.5 h-3.5" /> Cancelar envio</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};
