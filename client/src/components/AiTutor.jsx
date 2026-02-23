import { useState, useRef, useEffect } from 'react';
import api from '../services/api';

const AiAssistant = ({ formData, mode = 'tutor' }) => {
    // Mode configuration
    const config = {
        tutor: {
            title: 'AI Tutor',
            icon: 'school',
            color: '#6c63ff',
            gradient: 'linear-gradient(135deg, #6c63ff, #1a73e8)',
            endpoint: '/tutor/chat',
            suggestions: [
                { label: '🔍 Check Relevance', msg: '__analyze__' },
                { label: '🎯 Improve Objectives', msg: 'How can I improve my learning objectives?' },
                { label: '📝 Assessment Ideas', msg: 'Suggest formative assessment techniques.' },
            ]
        },
        process: {
            title: 'Process Assistant',
            icon: 'analytics',
            color: '#f59e0b',
            gradient: 'linear-gradient(135deg, #f59e0b, #ea580c)',
            endpoint: '/analytics/chat',
            suggestions: [
                { label: '📊 Compliance Report', msg: 'What is the current submission rate?' },
                { label: '🚨 List Overdue', msg: 'Which teachers have overdue plans?' },
                { label: '📧 Draft Reminder', msg: 'Draft a reminder email for late submissions.' },
            ]
        },
        department: {
            title: 'HOD Assistant',
            icon: 'supervisor_account',
            color: '#0ea5e9',
            gradient: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
            endpoint: '/analytics/chat',
            suggestions: [
                { label: '📉 At-Risk Teachers', msg: 'Which teachers have low readiness scores?' },
                { label: '📝 Review Performance', msg: 'Summarize the department performance.' },
                { label: '💡 Coaching Tips', msg: 'Give me coaching tips for struggling teachers.' },
            ]
        }
    };

    const currentConfig = config[mode] || config.tutor;

    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: 'ai',
            text: `Hi! I'm your ${currentConfig.title} ✨ I'm here to help you.`,
            time: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const chatEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, open]);

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    const sendMessage = async (text) => {
        if (!text?.trim() || loading) return;

        const userMsg = { role: 'user', text: text.trim(), time: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const history = messages.filter(m => m.role !== 'system').map(m => ({
                role: m.role === 'ai' ? 'assistant' : 'user',
                text: m.text
            }));

            const payload = mode === 'tutor'
                ? { message: text.trim(), lessonPlan: formData, history }
                : { message: text.trim(), mode, history }; // Analytics payload

            const res = await api.post(currentConfig.endpoint, payload);

            setMessages(prev => [...prev, {
                role: 'ai',
                text: res.data.reply,
                time: new Date()
            }]);
        } catch (err) {
            const errMsg = err.response?.status === 429
                ? "I'm a bit busy right now — try again in a few seconds! 🕐"
                : err.response?.data?.error || "Sorry, I couldn't respond. Please try again.";
            setMessages(prev => [...prev, { role: 'ai', text: errMsg, time: new Date(), isError: true }]);
        } finally {
            setLoading(false);
        }
    };

    const suggestions = currentConfig.suggestions;
    const hasContent = mode !== 'tutor' || (formData && (formData.title || formData.subject));

    return (
        <>
            {/* FAB Button */}
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    id={`ai-${mode}-fab`}
                    style={{
                        position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
                        width: 60, height: 60, borderRadius: '50%',
                        background: currentConfig.gradient,
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 4px 20px ${currentConfig.color}66`,
                        animation: 'tutorPulse 2s infinite',
                        transition: 'transform 0.2s'
                    }}
                    onMouseEnter={e => e.target.style.transform = 'scale(1.1)'}
                    onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                >
                    <span className="material-icons-outlined" style={{ color: '#fff', fontSize: 28 }}>{currentConfig.icon}</span>
                </button>
            )}

            {/* Chat Panel */}
            {open && (
                <div style={{
                    position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
                    width: 380, height: 540,
                    borderRadius: 20, overflow: 'hidden',
                    background: '#fff',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
                    display: 'flex', flexDirection: 'column',
                    animation: 'tutorSlideUp 0.3s ease-out'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '14px 18px',
                        background: currentConfig.gradient,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexShrink: 0
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 34, height: 34, borderRadius: 10,
                                background: 'rgba(255,255,255,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <span className="material-icons-outlined" style={{ color: '#fff', fontSize: 20 }}>{currentConfig.icon}</span>
                            </div>
                            <div>
                                <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{currentConfig.title}</div>
                                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10 }}>Powered by Gemini</div>
                            </div>
                        </div>
                        <button onClick={() => setOpen(false)} style={{
                            background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer',
                            borderRadius: 8, padding: 6, display: 'flex'
                        }}>
                            <span className="material-icons-outlined" style={{ color: '#fff', fontSize: 18 }}>close</span>
                        </button>
                    </div>

                    {/* Messages */}
                    <div style={{
                        flex: 1, overflowY: 'auto', padding: '14px 14px 8px',
                        display: 'flex', flexDirection: 'column', gap: 10,
                        background: '#f8f9fb'
                    }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                gap: 8
                            }}>
                                {msg.role === 'ai' && (
                                    <div style={{
                                        width: 28, height: 28, borderRadius: 8,
                                        background: msg.isError ? '#fef2f2' : currentConfig.gradient,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0, marginTop: 2
                                    }}>
                                        <span className="material-icons-outlined" style={{
                                            color: msg.isError ? '#dc2626' : '#fff', fontSize: 14
                                        }}>
                                            {msg.isError ? 'error' : 'auto_awesome'}
                                        </span>
                                    </div>
                                )}
                                <div style={{
                                    maxWidth: '78%',
                                    padding: '10px 14px',
                                    borderRadius: msg.role === 'user'
                                        ? '16px 16px 4px 16px'
                                        : '16px 16px 16px 4px',
                                    background: msg.role === 'user'
                                        ? currentConfig.gradient
                                        : msg.isError ? '#fef2f2' : '#fff',
                                    color: msg.role === 'user' ? '#fff' : msg.isError ? '#991b1b' : '#1f2937',
                                    fontSize: 13, lineHeight: 1.6,
                                    boxShadow: msg.role === 'ai' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                }}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {loading && (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: 8,
                                    background: currentConfig.gradient,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <span className="material-icons-outlined" style={{ color: '#fff', fontSize: 14 }}>auto_awesome</span>
                                </div>
                                <div style={{
                                    padding: '10px 14px', borderRadius: '16px 16px 16px 4px',
                                    background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                    display: 'flex', gap: 4, alignItems: 'center'
                                }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: currentConfig.color, animation: 'tutorDot 1.2s infinite 0s' }} />
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: currentConfig.color, animation: 'tutorDot 1.2s infinite 0.2s' }} />
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: currentConfig.color, animation: 'tutorDot 1.2s infinite 0.4s' }} />
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Suggestion Chips */}
                    {messages.length <= 2 && !loading && (
                        <div style={{
                            padding: '6px 14px 4px', display: 'flex', flexWrap: 'wrap', gap: 6,
                            borderTop: '1px solid #f0f0f0', background: '#fff'
                        }}>
                            {suggestions.map((s, i) => (
                                <button key={i}
                                    onClick={() => sendMessage(s.msg)}
                                    // Only disable analytics in tutor mode if no content
                                    disabled={mode === 'tutor' && s.msg === '__analyze__' && !hasContent}
                                    style={{
                                        padding: '5px 10px', borderRadius: 20, border: '1px solid #e5e7eb',
                                        background: '#fafafa', fontSize: 11, cursor: 'pointer',
                                        color: '#374151', transition: 'all 0.15s',
                                        opacity: (mode === 'tutor' && s.msg === '__analyze__' && !hasContent) ? 0.5 : 1
                                    }}
                                    onMouseEnter={e => { e.target.style.background = '#e8f0fe'; e.target.style.borderColor = currentConfig.color; }}
                                    onMouseLeave={e => { e.target.style.background = '#fafafa'; e.target.style.borderColor = '#e5e7eb'; }}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div style={{
                        padding: '10px 14px', borderTop: '1px solid #f0f0f0',
                        display: 'flex', gap: 8, background: '#fff', flexShrink: 0
                    }}>
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                            placeholder={`Ask ${currentConfig.title}...`}
                            disabled={loading}
                            id={`ai-${mode}-input`}
                            style={{
                                flex: 1, padding: '10px 14px', borderRadius: 12,
                                border: '1px solid #e5e7eb', fontSize: 13,
                                outline: 'none', transition: 'border-color 0.2s',
                                background: '#f9fafb'
                            }}
                            onFocus={e => e.target.style.borderColor = currentConfig.color}
                            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                        />
                        <button
                            onClick={() => sendMessage(input)}
                            disabled={!input.trim() || loading}
                            style={{
                                width: 40, height: 40, borderRadius: 12,
                                background: input.trim() && !loading
                                    ? currentConfig.gradient : '#e5e7eb',
                                border: 'none', cursor: input.trim() ? 'pointer' : 'default',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s', flexShrink: 0
                            }}
                        >
                            <span className="material-icons-outlined" style={{
                                color: input.trim() && !loading ? '#fff' : '#9ca3af', fontSize: 18
                            }}>send</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Animations */}
            <style>{`
                @keyframes tutorPulse {
                    0%, 100% { box-shadow: 0 4px 20px ${currentConfig.color}66; }
                    50% { box-shadow: 0 4px 30px ${currentConfig.color}99; }
                }
                @keyframes tutorSlideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes tutorDot {
                    0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
                    30% { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </>
    );
};

export default AiAssistant;
