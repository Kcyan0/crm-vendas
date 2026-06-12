const fs = require('fs');

const pageFile = 'src/app/dashboard/page.tsx';
let content = fs.readFileSync(pageFile, 'utf8');

const targetStr = '<div className="flex flex-col sm:flex-row items-center gap-3 p-2 rounded-xl" style={{ background: DARK, border: `1px solid ${BORDER}` }}>';

const toggleButton = `
                <div className="flex flex-col sm:flex-row items-end gap-3">
                    <button 
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={\`flex items-center gap-2 px-4 py-2 font-bold rounded-lg border transition-all \${isEditMode ? 'bg-[#BEFF00] text-black border-[#BEFF00]' : 'bg-[#111] text-[#888] border-[#2A2A2A] hover:text-white hover:border-[#444]'}\`}
                        style={{ height: '42px' }}
                    >
                        <Settings size={16} />
                        {isEditMode ? '✔ Salvar Layout' : '⚙️ Layout'}
                    </button>
                    ${targetStr}
`;

if (content.includes(targetStr) && !content.includes('⚙️ Layout')) {
    // replace only the first instance of targetStr
    content = content.replace(targetStr, toggleButton);
    // and close the new flex wrapper at the end after the filter button
    content = content.replace('<button onClick={() => fetchMetrics(startDate, endDate)} className="w-full sm:w-auto btn-primary py-2 px-4 text-sm whitespace-nowrap sm:ml-2">Filtrar</button>\n                </div>\n            </div>', 
    '<button onClick={() => fetchMetrics(startDate, endDate)} className="w-full sm:w-auto btn-primary py-2 px-4 text-sm whitespace-nowrap sm:ml-2">Filtrar</button>\n                    </div>\n                </div>\n            </div>');
    fs.writeFileSync(pageFile, content);
    console.log("Successfully patched page.tsx header!");
} else {
    console.error("Could not find header bounds.");
}
