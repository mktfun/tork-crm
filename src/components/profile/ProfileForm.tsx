
import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema, type ProfileFormData } from '@/schemas/profileSchema';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Loader2, Camera } from 'lucide-react';

// Extended form data to include birthday message template
type ExtendedProfileFormData = ProfileFormData & {
  birthday_message_template?: string;
  role?: string;
};

export function ProfileForm() {
  const { data: profile, isLoading, refetch } = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Check if current user is admin
  const isAdmin = profile?.role === 'admin';
  
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    setValue,
    watch,
  } = useForm<ExtendedProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nome_completo: '',
      email: '',
      telefone: '',
      birthday_message_template: '',
    },
  });

  // Update form when profile data is loaded
  useEffect(() => {
    if (profile) {
      reset({
        nome_completo: profile.nome_completo || '',
        email: profile.email || '',
        telefone: profile.telefone || '',
        birthday_message_template: profile.birthday_message_template || '',
      });
    }
  }, [profile, reset]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida (JPG, PNG, etc.)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      // Delete old avatar if exists
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split('/avatars/')[1];
        if (oldPath) {
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast.success('Foto de perfil atualizada com sucesso!');
      refetch(); // Refresh profile data
    } catch (error: any) {
      console.error('Erro ao fazer upload do avatar:', error);
      toast.error('Erro ao atualizar foto de perfil');
    } finally {
      setIsUploadingAvatar(false);
      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const onSubmit = async (data: ExtendedProfileFormData) => {
    try {
      setIsSubmitting(true);
      
      // Prepare update data - exclude role if not admin
      const updateData: any = {
        nome_completo: data.nome_completo,
        email: data.email,
        telefone: data.telefone || null,
        birthday_message_template: data.birthday_message_template || null
      };

      // Only include role if user is admin (security measure)
      if (isAdmin && data.role) {
        updateData.role = data.role;
      }

      await updateProfileMutation.mutateAsync(updateData);
      toast.success('Perfil atualizado com sucesso!');
      reset(data); // Reset form with new data to clear dirty state
    } catch (error: any) {
      console.error('Erro ao atualizar perfil:', error);
      if (error.message?.includes('row-level security')) {
        toast.error('Erro de permissão ao atualizar perfil');
      } else {
        toast.error('Erro ao atualizar perfil');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Não foi possível carregar os dados do perfil.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Avatar Upload Section */}
      <div className="flex flex-col items-center gap-4 pb-6 border-b border-slate-700">
        <div 
          className="relative group cursor-pointer"
          onClick={handleAvatarClick}
        >
          <Avatar className="h-24 w-24 ring-2 ring-slate-700 ring-offset-2 ring-offset-slate-900">
            <AvatarImage src={profile.avatar_url || undefined} alt={profile.nome_completo} />
            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white text-2xl font-semibold">
              {getInitials(profile.nome_completo || 'U')}
            </AvatarFallback>
          </Avatar>
          
          {/* Overlay on hover */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            {isUploadingAvatar ? (
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            ) : (
              <Camera className="h-6 w-6 text-white" />
            )}
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleAvatarUpload}
          className="hidden"
        />
        
        <p className="text-sm text-muted-foreground">
          Clique na foto para alterar
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="nome_completo">Nome Completo *</Label>
          <Input
            id="nome_completo"
            {...register('nome_completo')}
            className="bg-slate-800/50 border-slate-700"
          />
          {errors.nome_completo && (
            <p className="text-sm text-red-400">{errors.nome_completo.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            className="bg-slate-800/50 border-slate-700"
          />
          {errors.email && (
            <p className="text-sm text-red-400">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            {...register('telefone')}
            placeholder="(11) 99999-9999"
            className="bg-slate-800/50 border-slate-700"
          />
          {errors.telefone && (
            <p className="text-sm text-red-400">{errors.telefone.message}</p>
          )}
        </div>

        {/* Role selection - only visible to admins */}
        {isAdmin && (
          <div className="space-y-2">
            <Label htmlFor="role">Função</Label>
            <Select
              value={profile.role}
              onValueChange={(value) => setValue('role', value)}
            >
              <SelectTrigger className="bg-slate-800/50 border-slate-700">
                <SelectValue placeholder="Selecione a função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="corretor">Corretor</SelectItem>
                <SelectItem value="assistente">Assistente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="birthday_message_template">
          Template de Mensagem de Aniversário
        </Label>
        <Textarea
          id="birthday_message_template"
          {...register('birthday_message_template')}
          placeholder="Parabéns pelo seu aniversário! Desejamos muito sucesso e felicidades!"
          className="bg-slate-800/50 border-slate-700 min-h-[100px]"
        />
        <p className="text-sm text-muted-foreground">
          Use {'{nome}'} para inserir o nome do cliente automaticamente
        </p>
      </div>

      <div className="flex justify-end space-x-4">
        <Button
          type="submit"
          disabled={!isDirty || isSubmitting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar Alterações'
          )}
        </Button>
      </div>

      {/* Security Notice */}
      <div className="text-xs text-muted-foreground border-t border-slate-700 pt-4">
        <p>🔒 Suas informações estão protegidas por políticas de segurança avançadas.</p>
        {!isAdmin && (
          <p>ℹ️ Alterações de função requerem privilégios de administrador.</p>
        )}
      </div>
    </form>
  );
}
