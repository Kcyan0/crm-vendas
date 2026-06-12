const fs = require('fs');

const pageFile = 'src/app/dashboard/page.tsx';
let content = fs.readFileSync(pageFile, 'utf8');

// 1. Add imports to the top
const importsToAdd = `import { Settings } from "lucide-react";\nimport { DashboardGrid } from "./DashboardGrid";\n`;
if (!content.includes('import { DashboardGrid }')) {
    content = content.replace('import { useState, useEffect } from "react";', `import { useState, useEffect } from "react";\n${importsToAdd}`);
}

// 2. Add isEditMode state inside Dashboard component
if (!content.includes('const [isEditMode, setIsEditMode]')) {
    content = content.replace('const [isLoading, setIsLoading] = useState(true);', `const [isLoading, setIsLoading] = useState(true);\n    const [isEditMode, setIsEditMode] = useState(false);`);
}

// 3. Add user from useProject
content = content.replace('const { selectedProject } = useProject();', 'const { selectedProject, user } = useProject();');

// 4. Add Layout Button to the Header where Date filters are
const targetHeaderStr = `<div className="flex flex-col sm:flex-row items-end gap-3">`;
const toggleButton = `                    <button 
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={\`flex items-center gap-2 px-4 py-2 font-bold rounded-lg border transition-all \${isEditMode ? 'bg-[#BEFF00] text-black border-[#BEFF00]' : 'bg-[#111] text-[#888] border-[#2A2A2A] hover:text-white hover:border-[#444]'}\`}
                    >
                        <Settings size={16} />
                        {isEditMode ? '✔ Salvar Layout' : '⚙️ Layout'}
                    </button>
                    <div className="flex flex-col sm:flex-row items-end gap-3">`;

if (content.indexOf(targetHeaderStr) !== -1 && !content.includes('⚙️ Layout')) {
    content = content.replace(targetHeaderStr, toggleButton);
}

// 5. Replace grid
const startIndex = content.indexOf('{/* ── Main Dashboard Fluid Grid');
if (startIndex !== -1) {
    const stringBefore = content.substring(0, startIndex);
    const stringAfter = `
        </div>
    );
}
`;
    // We replace everything from the start of the grid comment all the way to the end of the file
    // with our custom component and the closing tags.
    const replacementGrid = `{/* ── Main Dashboard Fluid Grid ─────────────────────────────────── */}
            <DashboardGrid 
                metrics={metrics} sdrs={sdrs} closers={closers} 
                formatBRL={formatBRL} CHART_COLORS={CHART_COLORS} 
                TEXT_SEC={TEXT_SEC} LIME={LIME} tooltipStyle={tooltipStyle}
                renderTicketDonut={renderTicketDonut}
                user={user} selectedProject={selectedProject}
                isEditMode={isEditMode}
            />`;
            
    fs.writeFileSync(pageFile, stringBefore + replacementGrid + stringAfter);
    console.log("Successfully patched page.tsx grid!");
} else {
    console.error("Could not find grid bounds.");
}
