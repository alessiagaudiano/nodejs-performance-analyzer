const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    ...props
}) => {

    const baseStyle = "inline-flex items-center font-medium rounded disabled:opacity-50 disable:pointer-events-none"

    const variants = {
        secondary: "bg-bg-card text-text-main hover:bg-bg-card-hover focus:ring-indigo-500",
        danger: "bg-red-600 text-text-main hover:bg-red-700 focus:ring-red-500",
        back: "bg-bg-card text-text-main hover:bg-bg-card-hover focus:ring-indigo-500",
        confirm: "bg-btn-confirm text-text-main hover:bg-btn-confirm-hover focus:ring-indigo-500",
        card: "bg-bg-card text-text-main hover:bg-bg-card-hover focus:ring-indigo-500"

    }

    const sizes = {
        sm: "px-3 py-1.5 text-xs justify-center",
        md: "px-4 py-2 text-sm justify-center",
        lg: "px-6 py-3 text-base justify-center",
        card: "h-14 px-8 text-lg flex justify-start"
    }

    const classes = `${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`

    return (
        <button className={classes} {...props}>
            {children}
        </button>
    )
};

export default Button;