import { useEffect, useRef, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import { Card, Spinner, Button, Badge } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

function timeOf(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function dateTimeOf(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function WhatsApp() {
  const [status, setStatus] = useState(null);
  const [conversations, setConversations] = useState(null);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef(null);

  function loadConversations() {
    api.whatsappConversations().then((rows) => {
      setConversations(rows);
      setSelected((prev) => prev || (rows[0] && rows[0].contact_phone) || null);
    });
  }

  useEffect(() => {
    api.whatsappStatus().then(setStatus);
    loadConversations();
    const id = setInterval(loadConversations, 8000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selected) {
      setMessages(null);
      return;
    }
    let cancelled = false;
    api.whatsappConversation(selected).then((rows) => {
      if (!cancelled) setMessages(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || !selected) return;
    setSending(true);
    setSendError('');
    try {
      await api.whatsappSend(selected, text);
      setDraft('');
      const rows = await api.whatsappConversation(selected);
      setMessages(rows);
      loadConversations();
    } catch (e) {
      setSendError(e.message || "Couldn't send the message.");
    } finally {
      setSending(false);
    }
  }

  if (status && !status.connected) {
    return (
      <Layout title="WhatsApp">
        <Card className="p-8 text-center max-w-md mx-auto mt-10">
          <div className="w-12 h-12 rounded-xl bg-wash flex items-center justify-center mx-auto mb-3">
            <Icon name="whatsapp" size={22} stroke="#93969a" />
          </div>
          <p className="text-sm font-medium text-ink mb-1">WhatsApp isn&rsquo;t connected</p>
          <p className="text-xs text-muted mb-4">
            Connect the shop&rsquo;s shared WhatsApp Business number in Settings to send and receive messages here.
          </p>
          <Button size="sm" onClick={() => (window.location.hash = '#/settings')}>Go to Settings</Button>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout title="WhatsApp">
      <div className="flex h-full min-h-0 gap-4">
        <Card className="w-full max-w-[320px] flex-shrink-0 flex flex-col min-h-0 p-0">
          <div className="px-4 py-3.5 border-b border-line flex-shrink-0">
            <p className="font-head uppercase tracking-wide text-[13px] font-semibold text-ink">Conversations</p>
            {status?.displayPhone && <p className="text-xs text-muted mt-0.5">{status.displayPhone}</p>}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {!conversations && <Spinner />}
            {conversations && conversations.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted">No conversations yet.</p>
            )}
            {conversations && conversations.map((c) => (
              <button
                key={c.contact_phone}
                type="button"
                onClick={() => setSelected(c.contact_phone)}
                className={`w-full text-left px-4 py-3 border-b border-lineSoft transition-colors ${
                  selected === c.contact_phone ? 'bg-wash' : 'hover:bg-wash/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink truncate">{c.contact_phone}</p>
                  <span className="text-[11px] text-faint flex-shrink-0">{timeOf(c.created_at)}</span>
                </div>
                <p className="text-xs text-muted truncate mt-0.5">
                  {c.direction === 'out' ? 'You: ' : ''}{c.body}
                </p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex-1 flex flex-col min-h-0 p-0">
          {!selected && (
            <div className="flex-1 flex items-center justify-center text-sm text-muted">
              Select a conversation
            </div>
          )}
          {selected && (
            <>
              <div className="px-5 py-3.5 border-b border-line flex-shrink-0 flex items-center justify-between">
                <p className="text-sm font-semibold text-ink font-mono">{selected}</p>
                <Badge tone="green">
                  <Icon name="whatsapp" size={11} /> WhatsApp
                </Badge>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-2.5">
                {!messages && <Spinner />}
                {messages && messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                        m.direction === 'out' ? 'bg-brand text-white' : 'bg-wash text-ink'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`text-[10.5px] mt-1 ${m.direction === 'out' ? 'text-white/70' : 'text-faint'}`}>
                        {dateTimeOf(m.created_at)}{m.direction === 'out' && m.status ? ` · ${m.status}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="px-4 py-3 border-t border-line flex-shrink-0">
                {sendError && <p className="text-xs text-rose mb-2">{sendError}</p>}
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand placeholder:text-faint"
                    placeholder="Type a message…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                  />
                  <Button onClick={send} disabled={sending || !draft.trim()}>
                    {sending ? '…' : <Icon name="send" size={14} />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </Layout>
  );
}
