"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Projeto = {
    id_projeto: number;
    nome: string;
    descricao?: string;
};

type UserType = {
    email: string;
} | null;

type ProjectContextType = {
    projetos: Projeto[];
    selectedProject: Projeto | null;
    setSelectedProject: (projeto: Projeto) => void;
    isLoading: boolean;
    user: UserType;
};

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

import { createClient } from '@/lib/supabase/browser';

export function ProjectProvider({ children }: { children: ReactNode }) {
    const [projetos, setProjetos] = useState<Projeto[]>([]);
    const [selectedProject, setSelectedProject] = useState<Projeto | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<UserType>(null);

    useEffect(() => {
        const fetchUserDataAndProjects = async () => {
            try {
                const supabase = createClient();
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser && authUser.email) {
                    setUser({ email: authUser.email });
                }
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
                console.error("Erro ao carregar sessão e projetos", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserDataAndProjects();
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
            isLoading,
            user
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
