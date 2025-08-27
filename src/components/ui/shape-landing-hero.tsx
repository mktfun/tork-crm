"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Circle, ArrowRight, Shield, FileText, Users, Calendar, DollarSign, BarChart3, CheckCircle, Clock, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";


function ElegantShape({
    className,
    delay = 0,
    width = 400,
    height = 100,
    rotate = 0,
    gradient = "from-white/[0.08]",
}: {
    className?: string;
    delay?: number;
    width?: number;
    height?: number;
    rotate?: number;
    gradient?: string;
}) {
    return (
        <motion.div
            initial={{
                opacity: 0,
                y: -150,
                rotate: rotate - 15,
            }}
            animate={{
                opacity: 1,
                y: 0,
                rotate: rotate,
            }}
            transition={{
                duration: 2.4,
                delay,
                ease: [0.23, 0.86, 0.39, 0.96],
                opacity: { duration: 1.2 },
            }}
            className={cn("absolute", className)}
        >
            <motion.div
                animate={{
                    y: [0, 15, 0],
                }}
                transition={{
                    duration: 12,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                }}
                style={{
                    width,
                    height,
                }}
                className="relative"
            >
                <div
                    className={cn(
                        "absolute inset-0 rounded-full",
                        "bg-gradient-to-r to-transparent",
                        gradient,
                        "backdrop-blur-[2px] border-2 border-white/[0.15]",
                        "shadow-[0_8px_32px_0_rgba(255,255,255,0.1)]",
                        "after:absolute after:inset-0 after:rounded-full",
                        "after:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent_70%)]"
                    )}
                />
            </motion.div>
        </motion.div>
    );
}

function HeroGeometric({
    badge = "Design Collective",
    title1 = "Elevate Your Digital Vision",
    title2 = "Crafting Exceptional Websites",
    description = "Crafting exceptional digital experiences through innovative design and cutting-edge technology.",
    showActions = false,
}: {
    badge?: string;
    title1?: string;
    title2?: string;
    description?: string;
    showActions?: boolean;
}) {
    const fadeUpVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: {
                duration: 1,
                delay: 0.5 + i * 0.2,
                ease: [0.25, 0.4, 0.25, 1],
            },
        }),
    };

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#030303]">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/[0.05] via-transparent to-emerald-600/[0.05] blur-3xl" />

            <div className="absolute inset-0 overflow-hidden">
                <ElegantShape
                    delay={0.3}
                    width={600}
                    height={140}
                    rotate={12}
                    gradient="from-blue-500/[0.15]"
                    className="left-[-10%] md:left-[-5%] top-[15%] md:top-[20%]"
                />

                <ElegantShape
                    delay={0.5}
                    width={500}
                    height={120}
                    rotate={-15}
                    gradient="from-emerald-500/[0.15]"
                    className="right-[-5%] md:right-[0%] top-[70%] md:top-[75%]"
                />

                <ElegantShape
                    delay={0.4}
                    width={300}
                    height={80}
                    rotate={-8}
                    gradient="from-slate-500/[0.15]"
                    className="left-[5%] md:left-[10%] bottom-[5%] md:bottom-[10%]"
                />

                <ElegantShape
                    delay={0.6}
                    width={200}
                    height={60}
                    rotate={20}
                    gradient="from-teal-500/[0.15]"
                    className="right-[15%] md:right-[20%] top-[10%] md:top-[15%]"
                />

                <ElegantShape
                    delay={0.7}
                    width={150}
                    height={40}
                    rotate={-25}
                    gradient="from-indigo-500/[0.15]"
                    className="left-[20%] md:left-[25%] top-[5%] md:top-[10%]"
                />
            </div>

            <div className="relative z-10 container mx-auto px-4 md:px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <motion.div
                        custom={0}
                        variants={fadeUpVariants}
                        initial="hidden"
                        animate="visible"
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] mb-8 md:mb-12"
                    >
                        <Circle className="h-2 w-2 fill-blue-500/80" />
                        <span className="text-sm text-white/60 tracking-wide">
                            {badge}
                        </span>
                    </motion.div>

                    <motion.div
                        custom={1}
                        variants={fadeUpVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold mb-6 md:mb-8 tracking-tight">
                            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
                                {title1}
                            </span>
                            <br />
                            <span
                                className={cn(
                                    "bg-clip-text text-transparent bg-gradient-to-r from-blue-300 via-white/90 to-slate-300 "
                                )}
                            >
                                {title2}
                            </span>
                        </h1>
                    </motion.div>

                    <motion.div
                        custom={2}
                        variants={fadeUpVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <p className="text-base sm:text-lg md:text-xl text-white/40 mb-8 leading-relaxed font-light tracking-wide max-w-xl mx-auto px-4">
                            {description}
                        </p>
                    </motion.div>

                    {showActions && (
                        <motion.div
                            custom={3}
                            variants={fadeUpVariants}
                            initial="hidden"
                            animate="visible"
                            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
                        >
                            <a
                                href="/auth"
                                className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                            >
                                <span className="flex items-center gap-2">
                                    Acessar Sistema
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </a>

                            <a
                                href="/auth"
                                className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all duration-300 backdrop-blur-sm border border-white/20 hover:border-white/40"
                            >
                                Criar Conta Grátis
                            </a>
                        </motion.div>
                    )}

                    {showActions && (
                        <motion.div
                            custom={4}
                            variants={fadeUpVariants}
                            initial="hidden"
                            animate="visible"
                            className="flex flex-wrap justify-center gap-8 text-white/60"
                        >
                            <div className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-blue-400" />
                                <span className="text-sm font-medium">Gestão de Apólices</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-emerald-400" />
                                <span className="text-sm font-medium">Controle de Renovações</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-purple-400" />
                                <span className="text-sm font-medium">Gestão de Clientes</span>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-[#030303]/80 pointer-events-none" />
        </div>
    );
}

// Features Section Component
function FeaturesSection() {
    const fadeUpVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: {
                duration: 1,
                delay: 0.2 + i * 0.1,
                ease: [0.25, 0.4, 0.25, 1],
            },
        }),
    };

    const features = [
        {
            icon: Shield,
            title: "Gestão de Apólices",
            description: "Controle completo de todas as suas apólices com alertas automáticos de vencimento e renovação.",
            gradient: "from-blue-500/[0.15]"
        },
        {
            icon: Users,
            title: "Gestão de Clientes",
            description: "Base completa de clientes com histórico de interações e documentos organizados.",
            gradient: "from-emerald-500/[0.15]"
        },
        {
            icon: Calendar,
            title: "Agendamentos",
            description: "Sistema inteligente de agendamentos com lembretes automáticos para você e seus clientes.",
            gradient: "from-slate-500/[0.15]"
        },
        {
            icon: DollarSign,
            title: "Controle Financeiro",
            description: "Acompanhe comissões, faturamento e relatórios financeiros em tempo real.",
            gradient: "from-teal-500/[0.15]"
        },
        {
            icon: BarChart3,
            title: "Relatórios Inteligentes",
            description: "Dashboards e relatórios avançados para tomada de decisões estratégicas.",
            gradient: "from-indigo-500/[0.15]"
        },
        {
            icon: FileText,
            title: "Documentação Digital",
            description: "Armazene e organize todos os documentos importantes de forma segura na nuvem.",
            gradient: "from-blue-500/[0.12]"
        }
    ];

    return (
        <div className="relative w-full py-24 bg-[#030303] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-600/[0.03] via-transparent to-emerald-600/[0.03]" />

            {/* Background shapes */}
            <div className="absolute inset-0 overflow-hidden">
                <ElegantShape
                    delay={0.2}
                    width={400}
                    height={100}
                    rotate={8}
                    gradient="from-blue-500/[0.08]"
                    className="left-[-5%] top-[20%]"
                />
                <ElegantShape
                    delay={0.4}
                    width={300}
                    height={80}
                    rotate={-12}
                    gradient="from-emerald-500/[0.08]"
                    className="right-[-3%] bottom-[30%]"
                />
            </div>

            <div className="relative z-10 container mx-auto px-4 md:px-6">
                <motion.div
                    custom={0}
                    variants={fadeUpVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 tracking-tight">
                        <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
                            Funcionalidades
                        </span>
                        <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-300 via-white/90 to-slate-300">
                            Completas
                        </span>
                    </h2>
                    <p className="text-lg text-white/60 max-w-2xl mx-auto">
                        Todas as ferramentas que você precisa para gerenciar sua corretora de forma eficiente e profissional.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            custom={index + 1}
                            variants={fadeUpVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            className="relative group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r to-transparent rounded-2xl backdrop-blur-[2px] border border-white/[0.08] shadow-[0_8px_32px_0_rgba(255,255,255,0.05)] group-hover:border-white/20 transition-all duration-300" />
                            <div className="relative p-8 bg-white/[0.02] rounded-2xl backdrop-blur-sm">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="relative">
                                        <div className={cn(
                                            "w-12 h-12 rounded-xl bg-gradient-to-r to-transparent flex items-center justify-center",
                                            feature.gradient,
                                            "backdrop-blur-[2px] border border-white/[0.15]"
                                        )}>
                                            <feature.icon className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-semibold text-white">
                                        {feature.title}
                                    </h3>
                                </div>
                                <p className="text-white/70 leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Benefits Section Component
function BenefitsSection() {
    const fadeUpVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: {
                duration: 1,
                delay: 0.2 + i * 0.1,
                ease: [0.25, 0.4, 0.25, 1],
            },
        }),
    };

    const benefits = [
        {
            icon: Clock,
            title: "Economize Tempo",
            description: "Automatize processos e reduza o tempo gasto em tarefas administrativas em até 70%."
        },
        {
            icon: CheckCircle,
            title: "Nunca Perca Renovações",
            description: "Sistema inteligente de alertas garante que você nunca mais perca uma renovação importante."
        },
        {
            icon: Zap,
            title: "Aumente sua Produtividade",
            description: "Ferramentas integradas que permitem focar no que realmente importa: seus clientes."
        }
    ];

    return (
        <div className="relative w-full py-24 bg-gradient-to-b from-[#030303] to-[#020202] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-600/[0.03] via-transparent to-blue-600/[0.03]" />

            {/* Background shapes */}
            <div className="absolute inset-0 overflow-hidden">
                <ElegantShape
                    delay={0.3}
                    width={500}
                    height={120}
                    rotate={-8}
                    gradient="from-slate-500/[0.08]"
                    className="left-[-8%] top-[10%]"
                />
                <ElegantShape
                    delay={0.5}
                    width={350}
                    height={90}
                    rotate={15}
                    gradient="from-blue-500/[0.08]"
                    className="right-[-5%] top-[60%]"
                />
            </div>

            <div className="relative z-10 container mx-auto px-4 md:px-6">
                <motion.div
                    custom={0}
                    variants={fadeUpVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 tracking-tight">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-300 via-white/90 to-slate-300">
                            Por que escolher o SGC?
                        </span>
                    </h2>
                    <p className="text-lg text-white/60 max-w-2xl mx-auto">
                        Desenvolvido especificamente para corretoras de seguros por quem entende do mercado.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {benefits.map((benefit, index) => (
                        <motion.div
                            key={index}
                            custom={index + 1}
                            variants={fadeUpVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            className="text-center group"
                        >
                            <div className="relative inline-flex items-center justify-center w-20 h-20 mx-auto mb-6">
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/[0.15] to-slate-500/[0.15] rounded-2xl backdrop-blur-[2px] border border-white/[0.15] group-hover:border-white/30 transition-all duration-300" />
                                <benefit.icon className="relative w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-4">
                                {benefit.title}
                            </h3>
                            <p className="text-white/70 leading-relaxed">
                                {benefit.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Final CTA Section Component
function FinalCTASection() {
    const fadeUpVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: {
                duration: 1,
                delay: 0.2 + i * 0.2,
                ease: [0.25, 0.4, 0.25, 1],
            },
        }),
    };

    return (
        <div className="relative w-full py-24 bg-[#030303] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/[0.05] via-transparent to-slate-600/[0.05] blur-3xl" />

            {/* Background shapes */}
            <div className="absolute inset-0 overflow-hidden">
                <ElegantShape
                    delay={0.2}
                    width={600}
                    height={140}
                    rotate={10}
                    gradient="from-blue-500/[0.1]"
                    className="left-[-10%] top-[20%]"
                />
                <ElegantShape
                    delay={0.4}
                    width={400}
                    height={100}
                    rotate={-15}
                    gradient="from-slate-500/[0.1]"
                    className="right-[-5%] bottom-[20%]"
                />
            </div>

            <div className="relative z-10 container mx-auto px-4 md:px-6 text-center">
                <motion.div
                    custom={0}
                    variants={fadeUpVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                >
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 tracking-tight">
                        <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
                            Pronto para
                        </span>
                        <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-300 via-white/90 to-slate-300">
                            Revolucionar sua Corretora?
                        </span>
                    </h2>
                </motion.div>

                <motion.div
                    custom={1}
                    variants={fadeUpVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                >
                    <p className="text-lg md:text-xl text-white/60 mb-12 max-w-2xl mx-auto leading-relaxed">
                        Junte-se a centenas de corretores que já transformaram sua gestão com o SGC.
                        Comece gratuitamente hoje mesmo.
                    </p>
                </motion.div>

                <motion.div
                    custom={2}
                    variants={fadeUpVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="flex flex-col sm:flex-row gap-6 justify-center items-center"
                >
                    <a
                        href="/auth"
                        className="group relative px-10 py-5 bg-gradient-to-r from-blue-600 to-slate-600 hover:from-blue-700 hover:to-slate-700 text-white font-bold text-lg rounded-xl transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-blue-500/25"
                    >
                        <span className="flex items-center gap-3">
                            Começar Gratuitamente
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </span>
                    </a>

                    <p className="text-white/50 text-sm">
                        Sem cartão de crédito • Teste grátis • Suporte incluído
                    </p>
                </motion.div>
            </div>
        </div>
    );
}

export { HeroGeometric, FeaturesSection, BenefitsSection, FinalCTASection }
