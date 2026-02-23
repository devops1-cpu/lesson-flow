const Header = ({ title, children }) => {
    return (
        <header className="header">
            <h1 className="header-title">{title}</h1>
            {children}
        </header>
    );
};

export default Header;
