import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/images/logo.png'; // المسار الذي حددته للشعار

// الثوابت اللونية (يمكنك تعديل الـ Accent ليتناسب مع لون شعارك الفعلي)
const PALETTE = {
    background: 'rgba(15, 23, 42, 0.9)', // لون داكن مريح للعين
    glass: 'rgba(255, 255, 255, 0.05)',
    accent: '#ff7a45', // اللون البرتقالي الافتراضي (عدله لاحقاً)
    textMain: '#f8fafc',
    textMuted: '#94a3b8',
    glow: 'rgba(255, 122, 69, 0.15)' // توهج خلف الشعار
};

const SidebarDemo = () => {
    const location = useLocation();

    const menuItems = [
        { label: 'Dashboard', path: '/', icon: '📊' },
        { label: 'Merchants', path: '/merchants', icon: '🏪' },
        { label: 'Team', path: '/users', icon: '👥' },
        { label: 'Settings', path: '/settings', icon: '⚙️' },
    ];

    return (
        <div style={sidebarStyle} dir="ltr">
            {/* قسم الشعار مع توهج خلفي */}
            <div style={logoContainerStyle}>
                <div style={glowStyle}></div>
                <Link to="/">
                    <img src={logo} alt="Nawras Logo" style={logoStyle} />
                </Link>
            </div>

            {/* حقل البحث (HubSpot Style) */}
            <div style={searchContainerStyle}>
                <input type="text" placeholder="Quick search..." style={searchInputStyle} />
            </div>

            {/* قائمة الروابط */}
            <nav style={navStyle}>
                {menuItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        style={{
                            ...navItemStyle,
                            backgroundColor: location.pathname === item.path ? PALETTE.glass : 'transparent',
                            borderLeft: location.pathname === item.path ? `3px solid ${PALETTE.accent}` : '3px solid transparent'
                        }}
                    >
                        <span style={{ marginRight: '12px' }}>{item.icon}</span>
                        {item.label}
                        {item.label === 'Merchants' && <span style={badgeStyle}>New</span>}
                    </Link>
                ))}
            </nav>

            {/* الجزء السفلي: تحديثات وبطاقة المستخدم */}
            <div style={footerStyle}>
                <div style={whatsNewStyle}>
                    <span>✨ What's new?</span>
                </div>
                <div style={userCardStyle}>
                    <div style={avatarStyle}>AD</div>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Admin User</div>
                        <div style={{ fontSize: '12px', color: PALETTE.textMuted }}>Nawras CRM</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Styles (CSS-in-JS) ---

const sidebarStyle = {
    width: '260px',
    height: '100vh',
    backgroundColor: PALETTE.background,
    backdropFilter: 'blur(10px)',
    color: PALETTE.textMain,
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 0',
    borderRight: `1px solid ${PALETTE.glass}`,
    position: 'fixed',
    left: 0,
    top: 0
};

const logoContainerStyle = {
    padding: '0 20px 30px 20px',
    textAlign: 'center',
    position: 'relative'
};

const logoStyle = {
    width: '45px',
    height: '45px',
    borderRadius: '50%',
    objectFit: 'cover',
    position: 'relative',
    zIndex: 2,
    filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.45)) drop-shadow(0 2px 4px rgba(220,225,235,0.35))',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))'
};

const glowStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '70px',
    height: '70px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(200,210,225,0.15) 50%, transparent 75%)',
    filter: 'blur(14px)',
    opacity: 0.9,
    zIndex: 1
};

const searchContainerStyle = {
    padding: '0 20px 20px 20px'
};

const searchInputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: PALETTE.glass,
    color: PALETTE.textMain,
    fontSize: '14px',
    outline: 'none'
};

const navStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
};

const navItemStyle = {
    padding: '12px 20px',
    textDecoration: 'none',
    color: PALETTE.textMain,
    fontSize: '15px',
    display: 'flex',
    alignItems: 'center',
    transition: '0.2s ease',
    position: 'relative'
};

const badgeStyle = {
    marginLeft: 'auto',
    backgroundColor: PALETTE.accent,
    color: '#fff',
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '10px',
    fontWeight: 'bold'
};

const footerStyle = {
    padding: '20px',
    borderTop: `1px solid ${PALETTE.glass}`
};

const whatsNewStyle = {
    fontSize: '13px',
    color: PALETTE.accent,
    marginBottom: '15px',
    cursor: 'pointer',
    fontWeight: '500'
};

const userCardStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px',
    borderRadius: '12px',
    backgroundColor: PALETTE.glass
};

const avatarStyle = {
    width: '35px',
    height: '35px',
    borderRadius: '50%',
    backgroundColor: PALETTE.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '12px'
};

export default SidebarDemo;
