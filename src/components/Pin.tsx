import React from 'react';

interface PinProps {
  size?: number;
  className?: string;
}

const Pin: React.FC<PinProps> = ({ size = 40, className = '' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
    >
      <path
        d="M12 2c-4.418 0-8 3.582-8 8 0 5.25 8 12 8 12s8-6.75 8-12c0-4.418-3.582-8-8-8z"
        fill="#EF4444"
      />
      <circle cx="12" cy="10" r="4" fill="#FFFFFF" />
    </svg>
  );
};

export default Pin;