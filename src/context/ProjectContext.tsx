"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Projeto = {
    id_projeto: number;
    nome: string;
    descricao?: string;
};

type UserType = {
    email: string;
    tipo?: string | null;   // 'ADMIN' | 'EXPERT' | 'CLOSER' | 'SDR' | null
} | null;

type ProjectContextType = {
    projetos: Projeto[];
    selectedProject: Projeto | null;
    setSelectedProject: (projeto: Projeto) => void;
    isLoading: boolean;
    user: UserType;
    isAdmin: boolean;   // true for ADMIN or EXPERT roles
    userName: string;   // display name for activity logs
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
                    // Look up the user's role AND name in our usuarios table
                    const { data: dbUser } = await supabase
                        .from('usuarios')
                        .select('tipo, nome')
                        .eq('email', authUser.email.toLowerCase().trim())
                        .maybeSingle();
                    // If NOT in the team table → system owner → treat as ADMIN
                    const tipo = dbUser ? (dbUser.tipo ?? null) : 'ADMIN';
                    // Display name: from table if found, else email prefix
                    const nome = dbUser?.nome ?? authUser.email.split('@')[0];
                    setUser({ email: authUser.email, tipo, nome } as any);
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

    const ADMIN_ROLES = ['ADMIN', 'EXPERT'];
    const isAdmin = !!(user && ADMIN_ROLES.includes(((user as any).tipo ?? '').toUpperCase()));
    const userName: string = (user as any)?.nome ?? (user?.email?.split('@')[0] ?? 'Usuário');

    return (
        <ProjectContext.Provider value={{
            projetos,
            selectedProject,
            setSelectedProject: handleSelectProject,
            isLoading,
            user,
            isAdmin,
            userName,
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
