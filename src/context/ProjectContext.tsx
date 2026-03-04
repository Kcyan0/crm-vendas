"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Projeto = {
    id_projeto: number;
    nome: string;
    descricao?: string;
};

type ProjectContextType = {
    projetos: Projeto[];
    selectedProject: Projeto | null;
    setSelectedProject: (projeto: Projeto) => void;
    isLoading: boolean;
};

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
    const [projetos, setProjetos] = useState<Projeto[]>([]);
    const [selectedProject, setSelectedProject] = useState<Projeto | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchProjetos = async () => {
            try {
                const res = await fetch('/api/projetos');
                const data = await res.json();

                if (data.projetos && data.projetos.length > 0) {
                    setProjetos(data.projetos);

                    // Verifica se já existe um projeto salvo no localStorage e usa ele
                    const savedId = localStorage.getItem('feracrm_selected_project');
                    if (savedId) {
                        const project = data.projetos.find((p: Projeto) => p.id_projeto === parseInt(savedId));
                        if (project) {
                            setSelectedProject(project);
                        } else {
                            setSelectedProject(data.projetos[0]);
                        }
                    } else {
                        setSelectedProject(data.projetos[0]);
                    }
                }
            } catch (error) {
                console.error("Erro ao carregar projetos", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProjetos();
    }, []);

    const handleSelectProject = (projeto: Projeto) => {
        setSelectedProject(projeto);
        localStorage.setItem('feracrm_selected_project', projeto.id_projeto.toString());
        // Forçar reload das páginas sempre que um projeto é trocado para limpar estados antigos
        window.location.reload();
    };

    return (
        <ProjectContext.Provider value={{
            projetos,
            selectedProject,
            setSelectedProject: handleSelectProject,
            isLoading
        }}>
            {children}
        </ProjectContext.Provider>
    );
}

export function useProject() {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
}
