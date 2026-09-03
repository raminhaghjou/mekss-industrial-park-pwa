/**
 * Horizontal scroll wrapper so wide tables stay usable on phones
 * without pushing the whole app sideways.
 * @param {{ children: import('react').ReactNode, minWidth?: string }} props
 */
export const ResponsiveTable = ({ children, minWidth }) => (
  <div className="w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
    <div className="inline-block min-w-full align-middle" style={minWidth ? { minWidth } : undefined}>
      {children}
    </div>
  </div>
);

export default ResponsiveTable;
