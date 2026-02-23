import { useState, useEffect, useMemo, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const COLORS = [
    '#4285f4', '#ea4335', '#fbbc04', '#34a853', '#ff6d01', '#46bdc6', '#7baaf7',
    '#f07b72', '#fdd663', '#57bb8a', '#e8710a', '#af5cf7', '#24c1e0', '#f439a0',
    '#1a73e8', '#d93025', '#f9ab00', '#1e8e3e', '#e37400', '#009688', '#673ab7',
];
function hc(s) { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return COLORS[Math.abs(h) % COLORS.length] }

const ALL_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const DAY_SHORT = { MONDAY: 'Mo', TUESDAY: 'Tu', WEDNESDAY: 'We', THURSDAY: 'Th', FRIDAY: 'Fr', SATURDAY: 'Sa' };

export default function PublicTimetablePage() {
    const [loading, setLoading] = useState(true);
    const [slots, setSlots] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [days, setDays] = useState([]);
    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]);

    const [activeTab, setActiveTab] = useState('classes'); // classes, teachers
    const [selectedEntityId, setSelectedEntityId] = useState('');

    useEffect(() => {
        fetch(`${API}/timetable/public`)
            .then(res => res.json())
            .then(data => {
                setSlots(data.slots || []);
                setPeriods(data.periods || []);
                setDays(data.days || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
                setClasses(data.classes || []);
                setTeachers(data.teachers || []);

                // Select first class by default if available
                if (data.classes && data.classes.length > 0) setSelectedEntityId(data.classes[0].id);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load public timetable", err);
                setLoading(false);
            });
    }, []);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'classes' && classes.length > 0) setSelectedEntityId(classes[0].id);
        else if (tab === 'teachers' && teachers.length > 0) setSelectedEntityId(teachers[0].id);
        else setSelectedEntityId('');
    };

    // Filter slots based on active selection
    const filteredSlots = useMemo(() => {
        if (!selectedEntityId) return [];
        if (activeTab === 'classes') return slots.filter(s => s.classId === selectedEntityId);
        if (activeTab === 'teachers') return slots.filter(s => s.teacherId === selectedEntityId);
        return [];
    }, [slots, activeTab, selectedEntityId]);

    const slotMap = useMemo(() => {
        const m = {};
        for (const s of filteredSlots) {
            m[`${s.dayOfWeek}-${s.periodId}`] = s;
        }
        return m;
    }, [filteredSlots]);

    const P = {
        wrap: { display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#fff' },
        topBar: { backgroundColor: '#f27a3c', color: 'white', display: 'flex', padding: '0 20px', height: 48, alignItems: 'center', gap: 30, fontSize: 13, fontWeight: 'bold' },
        navItem: { cursor: 'pointer', textTransform: 'uppercase' },
        subBar: { backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6', display: 'flex', padding: '0 0', height: 40, alignItems: 'center', fontSize: 13 },
        subTab: (active) => ({ padding: '0 20px', height: '100%', display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: active ? 'bold' : 'normal', backgroundColor: active ? '#dcf3f9' : 'transparent', color: active ? '#000' : '#495057' }),

        main: { flex: 1, padding: '20px', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' },
        titleBar: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },

        table: { borderCollapse: 'collapse', width: '100%', maxWidth: 1400, tableLayout: 'fixed' },
        thCorner: { padding: 4, width: 60, border: 'none' },
        thPer: { padding: '5px 2px', textAlign: 'center', borderBottom: '1px solid #ced4da' },
        perNum: { fontSize: 18, fontWeight: 'bold', color: '#000' },
        perTime: { fontSize: 10, color: '#495057', marginTop: 2 },
        thDay: { padding: 10, fontSize: 18, textAlign: 'center', backgroundColor: '#fff', borderRight: '1px solid #ced4da' },

        cell: (bg) => ({ border: '2px solid #fff', height: 80, backgroundColor: bg || '#e9ecef', verticalAlign: 'top', position: 'relative', overflow: 'hidden' }),
        cellInner: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', padding: '6px' },
        subjText: { fontSize: 15, fontWeight: 'bold', textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
        botBar: { display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 'bold', color: '#212529', opacity: 0.8 }
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><h3>Loading Timetable...</h3></div>;

    const selectedEntityName =
        activeTab === 'classes' ? classes.find(c => c.id === selectedEntityId)?.name :
            activeTab === 'teachers' ? teachers.find(t => t.id === selectedEntityId)?.name : '';

    return (
        <div style={P.wrap}>
            {/* Top Orange Navigation */}
            <div style={P.topBar}>
                <div style={P.navItem}>MAIN PAGE</div>
                <div style={P.navItem}>TIMETABLE</div>
                <div style={P.navItem}>SUBSTITUTION</div>
                <div style={P.navItem}>CONTACT</div>
            </div>

            {/* Sub Navigation (Light Blue Tabs) */}
            <div style={P.subBar}>
                <div style={P.subTab(activeTab === 'classes')} onClick={() => handleTabChange('classes')}>CLASSES</div>
                <div style={P.subTab(activeTab === 'teachers')} onClick={() => handleTabChange('teachers')}>TEACHERS</div>

                <div style={{ marginLeft: 'auto', paddingRight: 20 }}>
                    <select value={selectedEntityId} onChange={e => setSelectedEntityId(e.target.value)} style={{ padding: '4px 10px', fontSize: 13 }}>
                        {activeTab === 'classes' && classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section || ''}</option>)}
                        {activeTab === 'teachers' && teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Grid Area */}
            <div style={P.main}>
                <div style={P.titleBar}>{selectedEntityName}</div>

                <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table style={P.table}>
                        <thead>
                            <tr>
                                <th style={P.thCorner}></th>
                                {periods.map(p => (
                                    <th key={p.id} style={P.thPer}>
                                        <div style={P.perNum}>{p.number}</div>
                                        <div style={P.perTime}>{p.startTime.substring(0, 5)} - {p.endTime.substring(0, 5)}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {days.map(d => (
                                <tr key={d} style={{ borderBottom: '1px solid #ced4da' }}>
                                    <th style={P.thDay}>{DAY_SHORT[d]}</th>
                                    {periods.map(p => {
                                        const slot = slotMap[`${d}-${p.id}`];
                                        const bg = slot?.subject?.color || (slot?.subject?.name ? hc(slot.subject.name) : undefined);
                                        return (
                                            <td key={p.id} style={P.cell(bg ? bg + '40' : undefined)}>
                                                {slot ? (
                                                    <div className="tt-tooltip" style={{ ...P.cellInner, width: '100%', height: '100%', cursor: 'pointer' }}>
                                                        {activeTab === 'classes' && <div style={{ fontSize: 9, opacity: 0.6, position: 'absolute', top: 4, right: 4 }}>{slot.room?.name || ''}</div>}

                                                        <div style={P.subjText}>{slot.subject?.code || slot.subject?.name || ''}</div>

                                                        <div style={P.botBar}>
                                                            {activeTab === 'classes' && <span>{slot.teacher?.name}</span>}
                                                            {activeTab === 'teachers' && <span>{slot.class?.name}</span>}
                                                        </div>

                                                        <div className="tt-tooltip-content">
                                                            <div className="tt-detail-row">
                                                                <span className="material-icons-outlined tt-detail-icon">schedule</span>
                                                                <div>
                                                                    <div className="tt-detail-label">Time</div>
                                                                    <div className="tt-detail-value">{p.startTime} - {p.endTime}</div>
                                                                </div>
                                                            </div>
                                                            <div className="tt-detail-row">
                                                                <span className="material-icons-outlined tt-detail-icon">subject</span>
                                                                <div>
                                                                    <div className="tt-detail-label">Subject</div>
                                                                    <div className="tt-detail-value">{slot.subject?.name}</div>
                                                                </div>
                                                            </div>
                                                            <div className="tt-detail-row">
                                                                <span className="material-icons-outlined tt-detail-icon">person</span>
                                                                <div>
                                                                    <div className="tt-detail-label">Teacher</div>
                                                                    <div className="tt-detail-value">{slot.teacher?.name}</div>
                                                                </div>
                                                            </div>
                                                            <div className="tt-detail-row">
                                                                <span className="material-icons-outlined tt-detail-icon">room</span>
                                                                <div>
                                                                    <div className="tt-detail-label">Room</div>
                                                                    <div className="tt-detail-value">{slot.room?.name || 'Not assigned'}</div>
                                                                </div>
                                                            </div>
                                                            <div className="tt-detail-row">
                                                                <span className="material-icons-outlined tt-detail-icon">groups</span>
                                                                <div>
                                                                    <div className="tt-detail-label">Class</div>
                                                                    <div className="tt-detail-value">{slot.class?.name} {slot.class?.section || ''}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : <div style={P.cellInner} />}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
