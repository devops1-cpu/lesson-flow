import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import AiTutor from '../components/AiTutor';
import api from '../services/api';

const CreateLessonPlan = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const location = useLocation();
    const isEdit = Boolean(id);
    const ocrPrefill = location.state?.prefill || null;

    const [form, setForm] = useState({
        title: '', subject: '', grade: '',
        objectives: [''],
        materials: [''],
        warmUp: '', instruction: '', guidedPractice: '',
        independentPractice: '', closure: '', assessment: '',
        differentiation: '', homework: '', notes: '',
        status: 'DRAFT', classId: ''
    });
    const [classes, setClasses] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchClasses();
        if (isEdit) fetchPlan();
        else if (ocrPrefill) {
            // Pre-fill from OCR scan
            setForm(prev => ({
                ...prev,
                title: ocrPrefill.title || '',
                subject: ocrPrefill.subject || '',
                grade: ocrPrefill.grade || '',
                objectives: ocrPrefill.objectives?.length ? ocrPrefill.objectives : [''],
                materials: ocrPrefill.materials?.length ? ocrPrefill.materials : [''],
                warmUp: ocrPrefill.warmUp || '',
                instruction: ocrPrefill.instruction || '',
                guidedPractice: ocrPrefill.guidedPractice || '',
                independentPractice: ocrPrefill.independentPractice || '',
                closure: ocrPrefill.closure || '',
                assessment: ocrPrefill.assessment || '',
                homework: ocrPrefill.homework || '',
                notes: ocrPrefill.notes || ''
            }));
        }
    }, [id]);

    const fetchClasses = async () => {
        try {
            const res = await api.get('/classes');
            // Only show classes that have a subject (not section placeholders)
            setClasses(res.data.filter(c => c.subject && c.subject.trim() !== ''));
        } catch (err) { console.error(err); }
    };

    const fetchPlan = async () => {
        try {
            const res = await api.get(`/lesson-plans/${id}`);
            const plan = res.data;
            setForm({
                title: plan.title || '', subject: plan.subject || '', grade: plan.grade || '',
                objectives: plan.objectives?.length ? plan.objectives : [''],
                materials: plan.materials?.length ? plan.materials : [''],
                warmUp: plan.warmUp || '', instruction: plan.instruction || '',
                guidedPractice: plan.guidedPractice || '',
                independentPractice: plan.independentPractice || '',
                closure: plan.closure || '', assessment: plan.assessment || '',
                differentiation: plan.differentiation || '', homework: plan.homework || '',
                notes: plan.notes || '', status: plan.status || 'DRAFT',
                classId: plan.classId || ''
            });
        } catch (err) { console.error(err); }
    };

    const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    // When a class is selected, auto-fill subject and grade
    const handleClassChange = (classId) => {
        const cls = classes.find(c => c.id === classId);
        setForm(prev => ({
            ...prev,
            classId: classId,
            subject: cls?.subject || prev.subject || '',
            grade: cls?.grade || prev.grade || ''
        }));
    };

    // Group classes by grade for organized dropdown
    const classesByGrade = useMemo(() => {
        const map = {};
        classes.forEach(c => {
            const grade = c.grade || 'Other';
            if (!map[grade]) map[grade] = [];
            map[grade].push(c);
        });
        // Sort grades numerically
        return Object.entries(map).sort((a, b) => {
            const na = parseInt(a[0]), nb = parseInt(b[0]);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return a[0].localeCompare(b[0]);
        });
    }, [classes]);

    // Get the selected class object
    const selectedClass = classes.find(c => c.id === form.classId);

    const handleArrayChange = (field, index, value) => {
        const arr = [...form[field]];
        arr[index] = value;
        setForm(prev => ({ ...prev, [field]: arr }));
    };

    const addArrayItem = (field) => setForm(prev => ({ ...prev, [field]: [...prev[field], ''] }));

    const removeArrayItem = (field, index) => {
        const arr = form[field].filter((_, i) => i !== index);
        setForm(prev => ({ ...prev, [field]: arr.length ? arr : [''] }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const payload = {
            ...form,
            subject: selectedClass?.subject || form.subject,
            grade: selectedClass?.grade || form.grade,
            objectives: form.objectives.filter(o => o.trim()),
            materials: form.materials.filter(m => m.trim()),
            classId: form.classId || null
        };

        try {
            if (isEdit) {
                await api.put(`/lesson-plans/${id}`, payload);
            } else {
                await api.post('/lesson-plans', payload);
            }
            navigate('/lesson-plans');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save lesson plan.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Header title={isEdit ? 'Edit Lesson Plan' : 'Create Lesson Plan'}>
                <button className="btn btn-ghost" onClick={() => navigate(-1)}>
                    <span className="material-icons-outlined">close</span>
                    Cancel
                </button>
            </Header>
            <div className="app-content">
                <div style={{ maxWidth: '800px' }}>
                    {error && <div className="auth-error">{error}</div>}
                    {ocrPrefill && !isEdit && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '12px 16px', borderRadius: 10,
                            background: '#ecfdf5', border: '1px solid #6ee7b7',
                            marginBottom: 20
                        }}>
                            <span className="material-icons-outlined" style={{ color: '#059669' }}>document_scanner</span>
                            <div>
                                <strong style={{ color: '#059669' }}>Form pre-filled from OCR scan.</strong>
                                <span style={{ color: '#4b5563', marginLeft: 6, fontSize: 13 }}>
                                    Review and correct the extracted data before saving.
                                </span>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* Basic Info */}
                        <div className="card mb-lg">
                            <div className="card-header" style={{ background: 'var(--primary)', minHeight: '60px' }}>
                                <h3>Basic Information</h3>
                            </div>
                            <div className="card-body">
                                <div className="form-group">
                                    <label className="form-label">Lesson Title *</label>
                                    <input type="text" className="form-input" placeholder="e.g., Introduction to Photosynthesis" value={form.title} onChange={(e) => handleChange('title', e.target.value)} required id="lesson-title" />
                                </div>

                                {/* Class selection — primary field */}
                                <div className="form-group">
                                    <label className="form-label">Class *</label>
                                    <select className="form-select" value={form.classId} onChange={(e) => handleClassChange(e.target.value)} required id="lesson-class"
                                        style={{ borderColor: form.classId ? '#10b981' : undefined }}>
                                        <option value="">— Select class —</option>
                                        {classesByGrade.map(([grade, clsList]) => (
                                            <optgroup key={grade} label={`Grade ${grade}`}>
                                                {clsList.map(c => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.section ? `Section ${c.section}` : c.name} — {c.subject || 'No subject'}
                                                        {c.owner ? ` (${c.owner.name})` : ''}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                    {selectedClass && (
                                        <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                                background: '#eef2ff', color: '#4f46e5'
                                            }}>
                                                📚 {selectedClass.subject}
                                            </span>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                                background: '#f0fdf4', color: '#16a34a'
                                            }}>
                                                🎓 Grade {selectedClass.grade}
                                            </span>
                                            {selectedClass.section && <span style={{
                                                padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                                background: '#fefce8', color: '#ca8a04'
                                            }}>
                                                🏫 Section {selectedClass.section}
                                            </span>}
                                            {selectedClass.owner && <span style={{
                                                padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                                background: '#fdf4ff', color: '#9333ea'
                                            }}>
                                                👤 {selectedClass.owner.name}
                                            </span>}
                                        </div>
                                    )}
                                </div>

                                {/* Subject — auto-filled from class */}
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Subject *
                                            {selectedClass && <span style={{ fontSize: 10, color: '#10b981', marginLeft: 6 }}>✓ from class</span>}
                                        </label>
                                        <input type="text" className="form-input" placeholder="e.g., Biology" value={form.subject}
                                            onChange={(e) => handleChange('subject', e.target.value)} required id="lesson-subject"
                                            readOnly={!!selectedClass}
                                            style={selectedClass ? { background: '#f8fafc', color: '#475569' } : {}}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="card mb-lg">
                            <div className="card-header" style={{ background: 'var(--accent-teal)', minHeight: '60px' }}>
                                <h3>Learning Objectives</h3>
                            </div>
                            <div className="card-body">
                                {form.objectives.map((obj, i) => (
                                    <div key={i} className="form-group" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input type="text" className="form-input" placeholder={`Objective ${i + 1}`} value={obj} onChange={(e) => handleArrayChange('objectives', i, e.target.value)} />
                                        <button type="button" className="btn-icon" onClick={() => removeArrayItem('objectives', i)}>
                                            <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--error)' }}>remove_circle</span>
                                        </button>
                                    </div>
                                ))}
                                <button type="button" className="btn btn-secondary" onClick={() => addArrayItem('objectives')} style={{ fontSize: '13px' }}>
                                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>add</span>
                                    Add Objective
                                </button>
                            </div>
                        </div>

                        {/* Materials */}
                        <div className="card mb-lg">
                            <div className="card-header" style={{ background: 'var(--accent-green)', minHeight: '60px' }}>
                                <h3>Materials & Resources</h3>
                            </div>
                            <div className="card-body">
                                {form.materials.map((mat, i) => (
                                    <div key={i} className="form-group" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input type="text" className="form-input" placeholder={`Material ${i + 1}`} value={mat} onChange={(e) => handleArrayChange('materials', i, e.target.value)} />
                                        <button type="button" className="btn-icon" onClick={() => removeArrayItem('materials', i)}>
                                            <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--error)' }}>remove_circle</span>
                                        </button>
                                    </div>
                                ))}
                                <button type="button" className="btn btn-secondary" onClick={() => addArrayItem('materials')} style={{ fontSize: '13px' }}>
                                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>add</span>
                                    Add Material
                                </button>
                            </div>
                        </div>

                        {/* Lesson Flow */}
                        <div className="card mb-lg">
                            <div className="card-header" style={{ background: 'var(--accent-orange)', minHeight: '60px' }}>
                                <h3>Lesson Flow</h3>
                            </div>
                            <div className="card-body">
                                <div className="form-group">
                                    <label className="form-label">Warm-Up / Bell Ringer</label>
                                    <textarea className="form-textarea" placeholder="How will you engage students at the start?" value={form.warmUp} onChange={(e) => handleChange('warmUp', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Direct Instruction</label>
                                    <textarea className="form-textarea" placeholder="Main teaching content and methods" value={form.instruction} onChange={(e) => handleChange('instruction', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Guided Practice</label>
                                    <textarea className="form-textarea" placeholder="Activities done together with teacher support" value={form.guidedPractice} onChange={(e) => handleChange('guidedPractice', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Independent Practice</label>
                                    <textarea className="form-textarea" placeholder="Activities students do on their own" value={form.independentPractice} onChange={(e) => handleChange('independentPractice', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Closure</label>
                                    <textarea className="form-textarea" placeholder="How will you wrap up the lesson?" value={form.closure} onChange={(e) => handleChange('closure', e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* Assessment & Extras */}
                        <div className="card mb-lg">
                            <div className="card-header" style={{ background: 'var(--accent-purple)', minHeight: '60px' }}>
                                <h3>Assessment & Additional Notes</h3>
                            </div>
                            <div className="card-body">
                                <div className="form-group">
                                    <label className="form-label">Assessment Strategy</label>
                                    <textarea className="form-textarea" placeholder="How will you assess student learning?" value={form.assessment} onChange={(e) => handleChange('assessment', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Differentiation</label>
                                    <textarea className="form-textarea" placeholder="Accommodations for different learners" value={form.differentiation} onChange={(e) => handleChange('differentiation', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Homework</label>
                                    <textarea className="form-textarea" placeholder="Assigned homework or follow-up work" value={form.homework} onChange={(e) => handleChange('homework', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Additional Notes</label>
                                    <textarea className="form-textarea" placeholder="Any other notes or reflections" value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* Submit */}
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginBottom: '48px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={loading} id="save-lesson">
                                <span className="material-icons-outlined">{isEdit ? 'save' : 'add_circle'}</span>
                                {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Lesson Plan'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            <AiTutor formData={form} />
        </>
    );
};

export default CreateLessonPlan;
