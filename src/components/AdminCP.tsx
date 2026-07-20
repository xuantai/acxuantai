import React, { useState, useEffect, useRef } from 'react';
import { 
  Smile, Plus, Trash2, Save, LogOut, Lock, Settings, User, Image as ImageIcon, 
  Share2, Sliders, Phone, Award, Info, Briefcase, GraduationCap, Music, Camera, 
  Globe, Check, Mail, RefreshCw, Eye, Keyboard, ArrowRight, ExternalLink
} from 'lucide-react';

interface RecordEntry {
  score: number;
  name: string;
  date: string;
  id: string;
}

export default function AdminCP() {
  const [password, setPassword] = useState(() => {
    return localStorage.getItem('acxt_admin_password') || '';
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('trangchu');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Model Config State
  const [config, setConfig] = useState<any>(null);

  // Background removal states
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessingBg, setIsProcessingBg] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // High score records states
  const [activeGame, setActiveGame] = useState('minesweeper_beginner');
  const [gameRecords, setGameRecords] = useState<RecordEntry[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingRecordName, setEditingRecordName] = useState('');

  // Password verification on first load
  useEffect(() => {
    if (password === 'MatKhauDay123') {
      setIsLoggedIn(true);
      fetchConfig();
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'MatKhauDay123') {
      localStorage.setItem('acxt_admin_password', password);
      setIsLoggedIn(true);
      setLoginError('');
      fetchConfig();
    } else {
      setLoginError('Mật khẩu không chính xác. Vui lòng thử lại!');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('acxt_admin_password');
    setPassword('');
    setIsLoggedIn(false);
  };

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin-config');
      const data = await res.json();
      setConfig(data);
    } catch (e) {
      console.error('Failed to load admin configuration:', e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch record for Tab 7
  useEffect(() => {
    if (isLoggedIn && activeTab === 'giaitri') {
      fetchGameRecords(activeGame);
    }
  }, [isLoggedIn, activeTab, activeGame]);

  const fetchGameRecords = async (gameId: string) => {
    setRecordsLoading(true);
    try {
      const res = await fetch(`/api.php?game=${gameId}`);
      const data = await res.json();
      setGameRecords(Array.isArray(data) ? data : []);
    } catch (e) {
      setGameRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, config })
      });
      const data = await res.json();
      if (data.success) {
        alert('Đã lưu cấu hình thành công!');
      } else {
        alert('Lưu thất bại: ' + (data.error || 'Lỗi không rõ'));
      }
    } catch (e: any) {
      alert('Đã xảy ra lỗi khi lưu cấu hình: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Render and process background removal
  useEffect(() => {
    // We do the background removal on user click now via remove.bg API
  }, [originalImage]);

  const applyTransparentBackground = async () => {
    if (!originalImage || isProcessingBg) return;
    try {
      setIsProcessingBg(true);
      
      const response = await fetch('/api/remove-bg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageB64: originalImage })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Server error removing background');
      }
      
      setProcessedImage(data.result);
      updateConfigField('coverImageTransparent', data.result);
      alert('Đã tách nền qua remove.bg và áp dụng ảnh bìa thành công!');

    } catch (e: any) {
      console.error(e);
      alert('Đã có lỗi khi tách nền: ' + e.message);
    } finally {
      setIsProcessingBg(false);
    }
  };

  // Helper functions to update state
  const updateConfigField = (field: string, value: any) => {
    setConfig((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const updateNestedField = (section: string, field: string, value: any) => {
    setConfig((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleFileUpload = (field: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        updateConfigField(field, e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Timelines (Education / Experience)
  const handleTimelineChange = (type: 'education' | 'experience', index: number, field: string, val: string) => {
    const list = [...config[type]];
    list[index] = { ...list[index], [field]: val };
    updateConfigField(type, list);
  };

  const addTimelineRow = (type: 'education' | 'experience') => {
    const list = [...config[type], { year: '', title: '', desc: '' }];
    updateConfigField(type, list);
  };

  const deleteTimelineRow = (type: 'education' | 'experience', index: number) => {
    const list = [...config[type]];
    list.splice(index, 1);
    updateConfigField(type, list);
  };

  // Picture Portfolio
  const handlePortfolioChange = (index: number, field: string, val: string) => {
    const list = [...config.portfolio];
    list[index] = { ...list[index], [field]: val };
    updateConfigField('portfolio', list);
  };

  const handlePortfolioImageUpload = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        handlePortfolioChange(index, 'imageUrl', e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const addPortfolioRow = () => {
    const list = [...config.portfolio, { imageUrl: '', title: '', role: '', url: '' }];
    updateConfigField('portfolio', list);
  };

  const deletePortfolioRow = (index: number) => {
    const list = [...config.portfolio];
    list.splice(index, 1);
    updateConfigField('portfolio', list);
  };

  const addServiceRow = () => {
    const list = [...(config.services || []), { name: '', desc: '' }];
    updateConfigField('services', list);
  };

  const deleteServiceRow = (index: number) => {
    const list = [...(config.services || [])];
    list.splice(index, 1);
    updateConfigField('services', list);
  };

  // Custom contact options
  const handleCustomContactChange = (index: number, field: string, val: string) => {
    const list = [...config.contacts.customOptions];
    list[index] = { ...list[index], [field]: val };
    updateNestedField('contacts', 'customOptions', list);
  };

  const addCustomContactRow = () => {
    const list = [...config.contacts.customOptions, { title: '', desc: '', url: '' }];
    updateNestedField('contacts', 'customOptions', list);
  };

  const deleteCustomContactRow = (index: number) => {
    const list = [...config.contacts.customOptions];
    list.splice(index, 1);
    updateNestedField('contacts', 'customOptions', list);
  };

  // Game Records manager
  const deleteGameRecord = async (idxToDelete: number) => {
    const updated = [...gameRecords];
    updated.splice(idxToDelete, 1);
    
    try {
      const res = await fetch('/api/admin/records/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, game: activeGame, records: updated })
      });
      const data = await res.json();
      if (data.success) {
        setGameRecords(updated);
        alert('Đã xóa kỷ lục thành công!');
      }
    } catch(e) {
      alert('Không thể xóa kỷ lục');
    }
  };

  const saveGameRecordName = async (recordId: string, idx: number) => {
    const updated = [...gameRecords];
    updated[idx] = { ...updated[idx], name: editingRecordName };
    
    try {
      const res = await fetch('/api/admin/records/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, game: activeGame, records: updated })
      });
      const data = await res.json();
      if (data.success) {
        setGameRecords(updated);
        setEditingRecordId(null);
        alert('Sửa tên thành công!');
      }
    } catch(e) {
      alert('Không sửa được tên kỷ lục');
    }
  };

  const clearAllGameRecords = async () => {
    if (!confirm(`Bạn có chắc chắn muốn XÓA TOÀN BỘ kỷ lục của game ${activeGame.toUpperCase()}?`)) return;
    try {
      const res = await fetch('/api/admin/records/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, game: activeGame, records: [] })
      });
      const data = await res.json();
      if (data.success) {
        setGameRecords([]);
        alert('Đã xóa toàn bộ kỷ lục thành công!');
      }
    } catch(e) {
      alert('Không thể xóa toàn bộ kỷ lục');
    }
  };

  // Unauthenticated Login Guard screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent_50%)]" />
        <div className="relative w-full max-w-md bg-slate-800/80 border border-slate-700/50 backdrop-blur-xl p-8 rounded-[32px] shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <Lock className="text-white" size={28} />
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">Admin Control Panel</h1>
            <p className="text-slate-400 text-sm mt-1">Hệ thống quản lý nội dung website A.C Xuân Tài</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 ml-1">Mật khẩu bảo mật</label>
              <input 
                type="password"
                placeholder="Nhập mật khẩu..."
                className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold outline-none focus:border-emerald-500 transition-all text-center placeholder:text-slate-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {loginError && (
              <p className="text-red-500 text-xs font-semibold text-center mt-1">{loginError}</p>
            )}

            <button 
              type="submit"
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Xác thực quản trị <ArrowRight size={14} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading || !config) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <RefreshCw size={40} className="text-emerald-500 animate-spin" />
        <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Đang tải cấu hình AdminCP...</p>
      </div>
    );
  }

  // Active Menu List
  const menus = [
    { id: 'trangchu', label: 'Trang chủ', icon: <Info size={16} /> },
    { id: 'vetoi', label: 'Về tôi', icon: <User size={16} /> },
    { id: 'hinhanh', label: 'Hình ảnh', icon: <ImageIcon size={16} /> },
    { id: 'mxh', label: 'Mạng xã hội', icon: <Share2 size={16} /> },
    { id: 'dichvu', label: 'Dịch vụ', icon: <Sliders size={16} /> },
    { id: 'lienhe', label: 'Liên hệ', icon: <Phone size={16} /> },
    { id: 'giaitri', label: 'Giải trí', icon: <Award size={16} /> },
    { id: 'floating', label: 'Nút nổi', icon: <Music size={16} /> },
  ];

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 flex flex-col font-sans" id="admin-dashboard">
      {/* Header Bar */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-black shadow-md">
            CP
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight leading-none text-emerald-400">Admin Control Panel</h1>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Hệ Thống Quản Trị Portfolio</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-700 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all cursor-pointer"
          >
            {saving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
            {saving ? 'Đang lưu...' : 'Lưu tất cả'}
          </button>
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-red-500 text-slate-300 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700/50"
          >
            <LogOut size={14} /> Đăng xuất
          </button>
        </div>
      </header>

      {/* Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <nav className="w-64 bg-slate-900 border-r border-slate-800 shrink-0 flex flex-col py-4">
          <div className="px-4 mb-4">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-2">Menu Tabs</span>
          </div>
          <div className="flex-1 space-y-1 px-2 overflow-y-auto">
            {menus.map((menu) => (
              <button
                key={menu.id}
                onClick={() => setActiveTab(menu.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTab === menu.id 
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {menu.icon}
                {menu.label}
              </button>
            ))}
          </div>
          <div className="p-4 border-t border-slate-800 text-center">
            <a 
              href="/" 
              target="_blank" 
              className="text-emerald-400 hover:text-emerald-300 text-[10px] font-bold uppercase flex items-center justify-center gap-1.5"
            >
              Xem trang portfolio <ExternalLink size={10} />
            </a>
          </div>
        </nav>

        {/* Content Panel Area */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-100">
          <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200/65 overflow-hidden p-8">
            
            {/* TAB 1: TRANG CHỦ */}
            {activeTab === 'trangchu' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4 mb-4">
                  <h2 className="text-base font-bold text-slate-800 tracking-tight">Cấu hình Trang chủ</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Quản lý logo, favicon, tiêu đề trình duyệt, ảnh bìa tách nền và các danh xưng thuật ngữ.</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 block">Tên nghệ sĩ</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-700 focus:border-emerald-500 outline-none"
                      value={config.artistName || ''}
                      onChange={(e) => updateConfigField('artistName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 block">Tiêu đề Website (Tab trình duyệt)</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-700 focus:border-emerald-500 outline-none"
                      value={config.websiteTitle || ''}
                      onChange={(e) => updateConfigField('websiteTitle', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 block">Mô tả 1 (Singer-songwriter...)</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-700 focus:border-emerald-500 outline-none"
                      value={config.bio1 || ''}
                      onChange={(e) => updateConfigField('bio1', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 block">Mô tả 2 (Founder & CEO...)</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-700 focus:border-emerald-500 outline-none"
                      value={config.bio2 || ''}
                      onChange={(e) => updateConfigField('bio2', e.target.value)}
                    />
                  </div>
                </div>

                {/* Logo and Favicon uploads */}
                <div className="grid grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div className="flex flex-col items-center text-center">
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Logo đen (Sáng màu)</label>
                    <div className="w-32 h-16 bg-white border border-slate-200 rounded-xl flex items-center justify-center p-2 overflow-hidden mb-3">
                      {config.logoUrl ? (
                        <img src={config.logoUrl} className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-[10px] text-slate-300">Không có logo</span>
                      )}
                    </div>
                    <label className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer transition-all">
                      Tải lên logo đen
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => e.target.files?.[0] && handleFileUpload('logoUrl', e.target.files[0])}
                      />
                    </label>
                  </div>

                  <div className="flex flex-col items-center text-center">
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Logo Trắng (Tối màu)</label>
                    <div className="w-32 h-16 bg-slate-800 rounded-xl flex items-center justify-center p-2 overflow-hidden mb-3">
                      {config.logoWhiteUrl ? (
                        <img src={config.logoWhiteUrl} className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-[10px] text-slate-400">Không có logo</span>
                      )}
                    </div>
                    <label className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer transition-all">
                      Tải lên logo trắng
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => e.target.files?.[0] && handleFileUpload('logoWhiteUrl', e.target.files[0])}
                      />
                    </label>
                  </div>

                  <div className="flex flex-col items-center text-center">
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Favicon Website</label>
                    <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center p-2 overflow-hidden mb-5">
                      {config.faviconUrl ? (
                        <img src={config.faviconUrl} className="max-h-full max-w-full object-contain rounded" />
                      ) : (
                        <span className="text-[10px] text-slate-300">N/A</span>
                      )}
                    </div>
                    <label className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer transition-all">
                      Tải lên Favicon
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => e.target.files?.[0] && handleFileUpload('faviconUrl', e.target.files[0])}
                      />
                    </label>
                  </div>
                </div>

                {/* BACKGROUND SEPARATION AREA */}
                <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Camera className="text-emerald-500" size={18} />
                      <h3 className="text-sm font-black uppercase tracking-tight">Tự động tách nền thông minh</h3>
                    </div>
                    <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full font-bold uppercase">Real-time canvas separation</span>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Controls & color picks */}
                    <div className="space-y-4 flex flex-col justify-center">
                      <p className="text-xs text-slate-400">Chọn ảnh chân dung/ảnh bìa (đứng trước màu nền tương đối đồng đều như phòng studio hoặc off-white) và trượt thanh kéo để tách nền tự động, đem lại độ thẩm mỹ cao.</p>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">1. Chọn nguồn ảnh gốc</label>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="text-xs text-slate-400"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              const r = new FileReader();
                              r.onload = (ev) => {
                                if (ev.target?.result) setOriginalImage(ev.target.result as string);
                              };
                              r.readAsDataURL(e.target.files[0]);
                            }
                          }}
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={applyTransparentBackground}
                          disabled={!originalImage || isProcessingBg}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-97 disabled:bg-slate-800 text-white text-[11px] font-black uppercase tracking-wider py-3.5 rounded-xl text-center cursor-pointer transition-all flex justify-center items-center gap-2"
                        >
                          {isProcessingBg && <RefreshCw size={14} className="animate-spin" />}
                          {isProcessingBg ? 'Đang Xử Lý AI...' : 'Tách Nền Bằng AI & Áp Dụng Chân Dung'}
                        </button>
                      </div>
                    </div>

                    {/* Image Canvas Output preview */}
                    <div className="flex flex-col items-center justify-center border border-slate-800 bg-slate-950 rounded-2xl p-4 min-h-[300px] text-center relative group overflow-hidden">
                      {processedImage ? (
                        <>
                          <img 
                            src={processedImage} 
                            alt="Processed Background"
                            className="max-w-full max-h-[250px] object-contain"
                          />
                        </>
                      ) : originalImage ? (
                         <>
                          <img 
                            src={originalImage} 
                            alt="Original Image"
                            className="max-w-full max-h-[250px] object-contain opacity-50 blur-sm"
                          />
                          {!isProcessingBg && <span className="text-white text-xs mt-2 absolute uppercase font-bold tracking-widest px-4 py-2 bg-black/60 rounded-lg">Nhấn nút bên trái để tách nền</span>}
                        </>
                      ) : (
                        <div className="text-slate-600 flex flex-col items-center p-6">
                          <Eye size={36} className="text-slate-700 mb-2" />
                          <p className="text-xs font-bold uppercase tracking-wider">Chưa chọn ảnh nguồn</p>
                          <p className="text-[10px] text-slate-600 leading-tight mt-1">Ảnh đã tách nền của bạn sẽ hiển thị kết quả kiểm nghiệm tại vị trí này.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* DYNAMIC ROLES */}
                <div>
                  <div className="flex items-center justify-between mb-3 ml-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Các vai trò (Music Producer / KOL ...)</label>
                    <button 
                      type="button" 
                      onClick={() => updateConfigField('roles', [...config.roles, ''])}
                      className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-emerald-500 hover:text-emerald-600 cursor-pointer"
                    >
                      <Plus size={14} /> Thêm vai trò mới
                    </button>
                  </div>
                  <div className="space-y-3">
                    {config.roles.map((role: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-slate-400 text-xs font-mono">#{idx+1}</span>
                        <input 
                          type="text"
                          className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-medium text-xs focus:border-emerald-500 outline-none"
                          placeholder="Nhập vai trò (ví dụ: Music Producer)..."
                          value={role}
                          onChange={(e) => {
                            const updated = [...config.roles];
                            updated[idx] = e.target.value;
                            updateConfigField('roles', updated);
                          }}
                        />
                        <button
                          onClick={() => {
                            const updated = [...config.roles];
                            updated.splice(idx, 1);
                            updateConfigField('roles', updated);
                          }}
                          className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: VỀ TÔI */}
            {activeTab === 'vetoi' && (
              <div className="space-y-8">
                <div className="border-b border-slate-100 pb-4 mb-4">
                  <h2 className="text-base font-bold text-slate-800 tracking-tight">Học vấn & Kinh nghiệm</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Cập nhật niên biểu chương trình đào học vấn (Education) và mốc dấu dấu ấn kinh nghiệm (Experience).</p>
                </div>

                {/* EDUCATION GRID */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-black uppercase text-slate-700 flex items-center gap-2">
                      <GraduationCap className="text-emerald-500 animate-pulse" size={18} /> Học Vấn
                    </h3>
                    <button
                      onClick={() => addTimelineRow('education')}
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-500 hover:text-emerald-600 cursor-pointer"
                    >
                      <Plus size={14} /> Thêm dòng Học Vấn
                    </button>
                  </div>

                  <div className="space-y-4">
                    {config.education.map((item: any, idx: number) => (
                      <div key={idx} className="bg-slate-50 p-5 rounded-2xl space-y-3 relative group border border-slate-100">
                        <button
                          onClick={() => deleteTimelineRow('education', idx)}
                          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>

                        <div className="grid grid-cols-4 gap-4 pr-10">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wild mb-1.5 block">Năm (Year)</label>
                            <input 
                              type="text"
                              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs"
                              placeholder="Ví dụ: 2012 - 2016"
                              value={item.year || ''}
                              onChange={(e) => handleTimelineChange('education', idx, 'year', e.target.value)}
                            />
                          </div>
                          <div className="col-span-3">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wild mb-1.5 block">Nội dung học vấn (Title)</label>
                            <input 
                              type="text"
                              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-bold"
                              placeholder="Ví dụ: Đại Học FPT"
                              value={item.title || ''}
                              onChange={(e) => handleTimelineChange('education', idx, 'title', e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wild mb-1 block">Chi tiết mô tả (Description)</label>
                          <textarea 
                            className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs min-h-[96px] resize-y"
                            placeholder="Mô tả cụ thể thông tin..."
                            value={item.desc || ''}
                            onChange={(e) => handleTimelineChange('education', idx, 'desc', e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* EXPERIENCE GRID */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-black uppercase text-slate-700 flex items-center gap-2">
                      <Briefcase className="text-emerald-500" size={18} /> Kinh Nghiệm
                    </h3>
                    <button
                      onClick={() => addTimelineRow('experience')}
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-500 hover:text-emerald-600 cursor-pointer"
                    >
                      <Plus size={14} /> Thêm dòng Kinh Nghiệm
                    </button>
                  </div>

                  <div className="space-y-4">
                    {config.experience.map((item: any, idx: number) => (
                      <div key={idx} className="bg-slate-50 p-5 rounded-2xl space-y-3 relative group border border-slate-100">
                        <button
                          onClick={() => deleteTimelineRow('experience', idx)}
                          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>

                        <div className="grid grid-cols-4 gap-4 pr-10">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wild mb-1.5 block">Năm (Year)</label>
                            <input 
                              type="text"
                              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs"
                              placeholder="Ví dụ: 2025"
                              value={item.year || ''}
                              onChange={(e) => handleTimelineChange('experience', idx, 'year', e.target.value)}
                            />
                          </div>
                          <div className="col-span-3">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wild mb-1.5 block">Tên chương trình / Đơn vị (Title)</label>
                            <input 
                              type="text"
                              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-bold"
                              placeholder="Ví dụ: Nhạc Phim điện ảnh Hoàng Tử Quỷ"
                              value={item.title || ''}
                              onChange={(e) => handleTimelineChange('experience', idx, 'title', e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wild mb-1 block">Chi tiết mô tả (Description)</label>
                          <textarea 
                            className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs min-h-[96px] resize-y"
                            placeholder="Mô tả cụ thể công việc đã sản xuất, thực hiện..."
                            value={item.desc || ''}
                            onChange={(e) => handleTimelineChange('experience', idx, 'desc', e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: HÌNH ẢNH */}
            {activeTab === 'hinhanh' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4 mb-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-base font-bold text-slate-800 tracking-tight">Kho Hình ảnh nổi bật</h2>
                    <p className="text-slate-400 text-xs mt-0.5">Ảnh sự kiện, TV show khách mời của A.C Xuân Tài (Gồm tệp, tiêu đề show, vai trò, đường dẫn).</p>
                  </div>
                  <button
                    onClick={addPortfolioRow}
                    className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition-all cursor-pointer"
                  >
                    <Plus size={14} /> Thêm ảnh mới
                  </button>
                </div>

                <div className="space-y-4">
                  {config.portfolio.map((item: any, idx: number) => (
                    <div key={idx} className="bg-slate-50 p-5 rounded-2xl flex gap-6 relative group border border-slate-100">
                      <button
                        onClick={() => deletePortfolioRow(idx)}
                        className="absolute right-4 top-4 p-2 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer"
                        title="Xóa mục hình ảnh này"
                      >
                        <Trash2 size={15} />
                      </button>

                      {/* Upload and preview */}
                      <div className="w-32 h-32 bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0 flex flex-col items-center justify-center p-1.5 text-center relative group-hover:border-emerald-500 transition-all">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <span className="text-[10px] text-slate-300">Không có ảnh</span>
                        )}
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-bold uppercase tracking-wider cursor-pointer rounded-lg transition-all">
                          Tải ảnh tập tin
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => e.target.files?.[0] && handlePortfolioImageUpload(idx, e.target.files[0])}
                          />
                        </label>
                      </div>

                      {/* Details inputs */}
                      <div className="flex-1 space-y-3 pr-8">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wild block mb-1">Tên chương trình (Chữ hoa nổi bật)</label>
                            <input 
                              type="text"
                              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-800"
                              placeholder="Ví dụ: Đấu Trường Âm Nhạc"
                              value={item.title || ''}
                              onChange={(e) => handlePortfolioChange(idx, 'title', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wild block mb-1">Vai trò của bạn</label>
                            <input 
                              type="text"
                              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs"
                              placeholder="Ví dụ: Khách mời / Người Chơi"
                              value={item.role || ''}
                              onChange={(e) => handlePortfolioChange(idx, 'role', e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                          <div className="col-span-3">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wild block mb-1">URL video / bài viết (Nút click h2 a)</label>
                            <input 
                              type="text"
                              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-mono text-emerald-600"
                              placeholder="Ví dụ: https://www.youtube.com/watch?..."
                              value={item.url || ''}
                              onChange={(e) => handlePortfolioChange(idx, 'url', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wild block mb-1">Hoặc điền URL nguồn ảnh trực tiếp</label>
                            <input 
                              type="text"
                              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-mono text-slate-500"
                              placeholder="Đường dẫn ảnh web..."
                              value={item.imageUrl.startsWith('data:') ? 'Dữ liệu Base64' : item.imageUrl}
                              onChange={(e) => {
                                if (!e.target.value.includes('Base64')) {
                                  handlePortfolioChange(idx, 'imageUrl', e.target.value);
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: MẠNG XÃ HỘI */}
            {activeTab === 'mxh' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4 mb-4">
                  <h2 className="text-base font-bold text-slate-800 tracking-tight">Mạng xã hội & Người theo dõi</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Lưu ý: Quá trình tự động đếm (scraping) followers thường bị MXH chặn (để bảo vệ dữ liệu), do vậy <strong className="text-red-500">BẠN CẦN CHỦ ĐỘNG NHẬP MỚI THỦ CÔNG</strong> số lượng followers bên dưới khi thay đổi ID mới.</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
                  {/* FACEBOOK */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-150 pb-6">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 flex items-center gap-1.5">
                        Facebook ID (Ví dụ: <strong>nxuantai</strong>)
                      </label>
                      <input 
                        type="text"
                        className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-slate-700 focus:border-emerald-500 outline-none font-bold"
                        value={config.socials?.facebook || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/https:\/\/(www\.)?facebook\.com\//, '').replace(/^\//, '');
                          setConfig((prev: any) => ({
                            ...prev,
                            socials: { ...prev.socials, facebook: val }
                          }));
                        }}
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Tương đương địa chỉ: https://facebook.com/{config.socials?.facebook || 'nxuantai'}</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 flex items-center gap-1.5">
                        Tên kênh Facebook (Để trống để tự động lấy từ Link)
                      </label>
                      <input 
                        type="text"
                        placeholder="Để trống để tự động cấu hình..."
                        className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-slate-700 focus:border-emerald-500 outline-none font-bold"
                        value={config.socials?.facebookName || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setConfig((prev: any) => ({
                            ...prev,
                            socials: { ...prev.socials, facebookName: val }
                          }));
                        }}
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Tên hiển thị: {config.socials?.facebookName || 'Sẽ lấy tên kênh thật nếu để trống'}</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 flex items-center gap-1.5">
                        Số người theo dõi Facebook (Mặc định: 82,190)
                      </label>
                      <input 
                        type="number"
                        className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-slate-700 focus:border-emerald-500 outline-none font-bold font-mono"
                        value={config.socials?.facebookFollowers !== undefined ? config.socials.facebookFollowers : 82190}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setConfig((prev: any) => ({
                            ...prev,
                            socials: { ...prev.socials, facebookFollowers: val }
                          }));
                        }}
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Giá trị hiện tại: {(config.socials?.facebookFollowers ?? 82190).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>

                  {/* TIKTOK */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-150 pb-6">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 flex items-center gap-1.5">
                        TikTok ID (Ví dụ: <strong>@acxuantai</strong>)
                      </label>
                      <input 
                        type="text"
                        className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-slate-700 focus:border-emerald-500 outline-none font-bold"
                        value={config.socials?.tiktok || ''}
                        onChange={(e) => {
                          let val = e.target.value.replace(/https:\/\/www\.tiktok\.com\//, '').replace(/https:\/\/tiktok\.com\//, '').replace(/^\//, '');
                          if (val && !val.startsWith('@')) val = '@' + val;
                          setConfig((prev: any) => ({
                            ...prev,
                            socials: { ...prev.socials, tiktok: val }
                          }));
                        }}
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Tương đương địa chỉ: https://tiktok.com/{config.socials?.tiktok || '@acxuantai'}</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 flex items-center gap-1.5">
                        Tên kênh TikTok (Để trống để tự động lấy từ Link)
                      </label>
                      <input 
                        type="text"
                        placeholder="Để trống để tự động cấu hình..."
                        className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-slate-700 focus:border-emerald-500 outline-none font-bold"
                        value={config.socials?.tiktokName || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setConfig((prev: any) => ({
                            ...prev,
                            socials: { ...prev.socials, tiktokName: val }
                          }));
                        }}
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Tên hiển thị: {config.socials?.tiktokName || 'Sẽ lấy tên kênh thật nếu để trống'}</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 flex items-center gap-1.5">
                        Số người theo dõi TikTok (Mặc định: 409,505)
                      </label>
                      <input 
                        type="number"
                        className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-slate-700 focus:border-emerald-500 outline-none font-bold font-mono"
                        value={config.socials?.tiktokFollowers !== undefined ? config.socials.tiktokFollowers : 409505}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setConfig((prev: any) => ({
                            ...prev,
                            socials: { ...prev.socials, tiktokFollowers: val }
                          }));
                        }}
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Giá trị hiện tại: {(config.socials?.tiktokFollowers ?? 409505).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>

                  {/* YOUTUBE */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 flex items-center gap-1.5">
                        YouTube ID (Ví dụ: <strong>@acxuantai</strong>)
                      </label>
                      <input 
                        type="text"
                        className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-slate-700 focus:border-emerald-500 outline-none font-bold"
                        value={config.socials?.youtube || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/https:\/\/(www\.)?youtube\.com\//, '').replace(/^\//, '');
                          setConfig((prev: any) => ({
                            ...prev,
                            socials: { ...prev.socials, youtube: val }
                          }));
                        }}
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Tương đương địa chỉ: https://youtube.com/{config.socials?.youtube || '@acxuantai'}</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 flex items-center gap-1.5">
                        Tên kênh YouTube (Để trống để tự động lấy từ Link)
                      </label>
                      <input 
                        type="text"
                        placeholder="Để trống để tự động cấu hình..."
                        className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-slate-700 focus:border-emerald-500 outline-none font-bold"
                        value={config.socials?.youtubeName || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setConfig((prev: any) => ({
                            ...prev,
                            socials: { ...prev.socials, youtubeName: val }
                          }));
                        }}
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Tên hiển thị: {config.socials?.youtubeName || 'Sẽ lấy tên kênh thật nếu để trống'}</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 flex items-center gap-1.5">
                        Số người đăng ký YouTube (Mặc định: 15,700)
                      </label>
                      <input 
                        type="number"
                        className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-slate-700 focus:border-emerald-500 outline-none font-bold font-mono"
                        value={config.socials?.youtubeFollowers !== undefined ? config.socials.youtubeFollowers : 15700}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setConfig((prev: any) => ({
                            ...prev,
                            socials: { ...prev.socials, youtubeFollowers: val }
                          }));
                        }}
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Giá trị hiện tại: {(config.socials?.youtubeFollowers ?? 15700).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: DỊCH VỤ */}
            {activeTab === 'dichvu' && (
              <div className="space-y-6">
                <div className="flex items-center gap-4 justify-between border-b border-slate-100 pb-4 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-800 tracking-tight">Biên mục Dịch vụ (Không giới hạn)</h2>
                    <p className="text-slate-400 text-xs mt-0.5">Thêm/bớt các dịch vụ hỗ trợ hợp tác chuyên nghiệp cùng thông số mô tả cụ thể.</p>
                  </div>
                  <button
                    onClick={addServiceRow}
                    className="flex shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-500 hover:text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                  >
                    <Plus size={14} /> Thêm dịch vụ
                  </button>
                </div>

                <div className="space-y-4">
                  {config.services?.map((service: any, idx: number) => (
                    <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3 relative group hover:border-emerald-500 transition-all flex gap-4">
                      
                      <button
                        onClick={() => deleteServiceRow(idx)}
                        className="absolute right-4 top-4 p-2 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer animate-fade-in"
                      >
                        <Trash2 size={14} />
                      </button>

                      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4 pr-8">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wild block mb-1">Tên dịch vụ {idx + 1}</label>
                          <input 
                            type="text"
                            className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm font-bold text-slate-800"
                            value={service.name || ''}
                            onChange={(e) => {
                              const updated = [...config.services];
                              updated[idx] = { ...updated[idx], name: e.target.value };
                              updateConfigField('services', updated);
                            }}
                            placeholder="Ví dụ: Sản Xuất"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wild block mb-1">Mô tả chi tiết</label>
                          <textarea 
                            className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs min-h-[60px] resize-y"
                            value={service.desc || ''}
                            onChange={(e) => {
                              const updated = [...config.services];
                              updated[idx] = { ...updated[idx], desc: e.target.value };
                              updateConfigField('services', updated);
                            }}
                            placeholder="Ví dụ: Sản xuất MV, Phim, Viral Clip..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: LIÊN HỆ */}
            {activeTab === 'lienhe' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4 mb-4">
                  <h2 className="text-base font-bold text-slate-800 tracking-tight">Thông Tin Liên hệ hợp tác</h2>
                  <p className="text-slate-400 text-xs mt-0.5">SĐT, Email, và cơ chế tùy chọn linh hoạt khi bấm nút dấu cộng.</p>
                </div>

                <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 block">Số điện thoại (SĐT)</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-slate-700 focus:border-emerald-500 outline-none font-bold"
                      value={config.contacts?.phone || ''}
                      onChange={(e) => updateNestedField('contacts', 'phone', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 block">Email liên hệ chính thức</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-slate-700 focus:border-emerald-500 outline-none font-bold"
                      value={config.contacts?.email || ''}
                      onChange={(e) => updateNestedField('contacts', 'email', e.target.value)}
                    />
                  </div>
                </div>

                {/* CUSTOM OPTIONS CORES */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4 justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-bold text-slate-800 tracking-tight pl-1 truncate">Các tùy chọn liên lạc bổ sung</h3>
                    <button
                      onClick={addCustomContactRow}
                      className="flex shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-500 hover:text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      <Plus size={14} /> Thêm tùy chọn mới
                    </button>
                  </div>

                  <div className="space-y-3">
                    {config.contacts?.customOptions?.map((item: any, idx: number) => (
                      <div key={idx} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 relative group flex gap-4">
                        <button
                          onClick={() => deleteCustomContactRow(idx)}
                          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer animate-fade-in"
                        >
                          <Trash2 size={14} />
                        </button>

                        <div className="flex-1 grid grid-cols-3 gap-4 pr-8">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wild block mb-1">Tùy chọn {idx+1}</label>
                            <input 
                              type="text"
                              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-700"
                              placeholder="Ví dụ: Kho nhạc & Demo"
                              value={item.title || ''}
                              onChange={(e) => handleCustomContactChange(idx, 'title', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wild block mb-1">Mô tả {idx+1} (Chữ hiển thị)</label>
                            <input 
                              type="text"
                              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs"
                              placeholder="Ví dụ: tài.vn"
                              value={item.desc || ''}
                              onChange={(e) => handleCustomContactChange(idx, 'desc', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wild block mb-1">Đường dẫn khi bấm (URL Link)</label>
                            <input 
                              type="text"
                              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-mono text-emerald-600"
                              placeholder="Ví dụ: https://tài.vn"
                              value={item.url || ''}
                              onChange={(e) => handleCustomContactChange(idx, 'url', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: GIẢI TRÍ */}
            {activeTab === 'giaitri' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4 mb-4">
                  <h2 className="text-base font-bold text-slate-800 tracking-tight">Thống kê & Quản lý kỷ lục Game</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Truy vết bảng thành tích người chơi, biên tập/sửa đổi tên tuổi và reset dữ liệu kỷ lục tại các minigame.</p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: 'minesweeper_beginner', label: 'Dò Mìn (Dễ)' },
                    { id: 'minesweeper_intermediate', label: 'Dò Mìn (TB)' },
                    { id: 'minesweeper_expert', label: 'Dò Mìn (Khó)' },
                    { id: '2048', label: 'Game 2048' },
                    { id: 'tetris', label: 'Xếp Hình' },
                    { id: 'pikachu', label: 'Pikachu' },
                  ].map((gameBtn) => (
                    <button
                      key={gameBtn.id}
                      onClick={() => setActiveGame(gameBtn.id)}
                      className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        activeGame === gameBtn.id 
                          ? 'bg-slate-900 text-white shadow-md'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {gameBtn.label} ({gameBtn.id.toUpperCase()})
                    </button>
                  ))}
                </div>

                {/* Records viewer */}
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                    <span className="text-xs font-black uppercase text-slate-600 tracking-wider">Bảng xếp hạng Top 10 của ID: {activeGame.toUpperCase()}</span>
                    <button
                      onClick={clearAllGameRecords}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Xóa toàn bộ kỉ lục
                    </button>
                  </div>

                  {recordsLoading ? (
                    <div className="text-center py-12 text-slate-400 text-xs font-bold uppercase tracking-widest">
                      <RefreshCw className="animate-spin inline-block mr-2 text-emerald-500" size={16} /> Đang tải bảng thành tích...
                    </div>
                  ) : gameRecords.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 italic text-sm">Chưa có người chơi nào ghi nhận kỉ lục cho game này.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-2.5 pl-2">Hạng</th>
                            <th className="py-2.5">Người chơi</th>
                            <th className="py-2.5">Điểm / Thành tích</th>
                            <th className="py-2.5">Thời gian cập nhật</th>
                            <th className="py-2.5 text-right pr-2">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {gameRecords.map((rec, idx) => (
                            <tr key={rec.id || idx} className="hover:bg-slate-100/50">
                              <td className="py-3 pl-2 font-bold font-mono text-slate-400">#{idx+1}</td>
                              <td className="py-3">
                                {editingRecordId === rec.id ? (
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="text"
                                      className="px-2 py-1 border border-emerald-500 rounded text-xs font-bold text-slate-700 bg-white"
                                      value={editingRecordName}
                                      onChange={(e) => setEditingRecordName(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && saveGameRecordName(rec.id, idx)}
                                      autoFocus
                                    />
                                    <button 
                                      onClick={() => saveGameRecordName(rec.id, idx)}
                                      className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[10px] font-bold uppercase"
                                    >
                                      Lưu
                                    </button>
                                    <button
                                      onClick={() => setEditingRecordId(null)}
                                      className="p-1.5 bg-slate-200 text-slate-500 rounded text-[10px]"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                    {rec.name}
                                    <button
                                      onClick={() => {
                                        setEditingRecordId(rec.id);
                                        setEditingRecordName(rec.name);
                                      }}
                                      className="text-[10px] text-emerald-500 hover:underline hover:text-emerald-600 font-medium cursor-pointer"
                                    >
                                      [Sửa tên]
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 font-mono font-black text-slate-900 text-sm">
                                {rec.score} {activeGame.startsWith('minesweeper') ? 'giây' : 'điểm'}
                              </td>
                              <td className="py-3 text-slate-400">
                                {rec.date ? new Date(rec.date).toLocaleString('vi-VN') : 'Unknown'}
                              </td>
                              <td className="py-3 text-right pr-2">
                                <button
                                  onClick={() => deleteGameRecord(idx)}
                                  className="text-red-500 hover:bg-red-100 p-1.5 rounded transition-all cursor-pointer"
                                  title="Xóa kỷ lục"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 8: FLOATING BUTTON */}
            {activeTab === 'floating' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4 mb-4">
                  <h2 className="text-base font-bold text-slate-800 tracking-tight">Floating Action Button (Nút nổi)</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Biên soạn nội dung và tùy biến icon/đường dắt của nút nổi ở góc dưới đáy màn hình bên phải.</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 block">Nội dung văn bản (Nút nổi)</label>
                      <input 
                        type="text"
                        className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-slate-700 focus:border-emerald-500 outline-none font-bold"
                        value={config.floatingButton?.text || ''}
                        onChange={(e) => updateNestedField('floatingButton', 'text', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 block">Đường dẫn đích (Target URL)</label>
                      <input 
                        type="text"
                        className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-slate-700 focus:border-emerald-500 outline-none font-bold font-mono text-emerald-600"
                        value={config.floatingButton?.url || ''}
                        onChange={(e) => updateNestedField('floatingButton', 'url', e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 ml-1 block">Biểu tượng hiển thị (Icon)</label>
                    <div className="grid grid-cols-5 gap-3">
                      {[
                        { id: 'music', label: 'Nốt Nhạc', el: <Music size={16} /> },
                        { id: 'phone', label: 'Điện Thoại', el: <Phone size={16} /> },
                        { id: 'mail', label: 'Thư Điện Tử', el: <Mail size={16} /> },
                        { id: 'globe', label: 'Web/Liên Kết', el: <Globe size={16} /> },
                        { id: 'award', label: 'Kỷ Lục/Cúp', el: <Award size={16} /> },
                      ].map((icOption) => (
                        <button
                          key={icOption.id}
                          type="button"
                          onClick={() => updateNestedField('floatingButton', 'icon', icOption.id)}
                          className={`flex items-center gap-2 p-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            config.floatingButton?.icon === icOption.id 
                              ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {icOption.el} {icOption.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
