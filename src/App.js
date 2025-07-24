import React, { useState, useMemo, useEffect } from 'react';
import { 
  Package, 
  AlertCircle, 
  CheckCircle, 
  LogOut,
  Search,
  Plus,
  Users,
  BarChart3,
  Menu,
  X,
  Edit2,
  Trash2,
  Save,
  ArrowLeft,
  Lock,
  Unlock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Home,
  Activity,
  TrendingUp,
  Settings,
  KeyRound,
  Shield
} from 'lucide-react';
import { supabase, handleSupabaseError, createEmailFromCP } from './supabaseClient';
import * as XLSX from 'xlsx';

const InventoryManagementApp = () => {
  // États principaux
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [numeroCP, setNumeroCP] = useState('');
  const [password, setPassword] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [newPinCode, setNewPinCode] = useState('');
  const [confirmPinCode, setConfirmPinCode] = useState('');
  const [notification, setNotification] = useState('');
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [formData, setFormData] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [filters, setFilters] = useState({
    natureDepot: '',
    localisation: ''
  });
  const [editedUsers, setEditedUsers] = useState({});
  const [showPinLogin, setShowPinLogin] = useState(false);
  const [rememberCP, setRememberCP] = useState(false);
  const [userHasPin, setUserHasPin] = useState(false);

  // Données de l'application
  const [users, setUsers] = useState({});
  const [articles, setArticles] = useState([]);

  // Charger le CP mémorisé au début
  useEffect(() => {
    const savedCP = localStorage.getItem('rememberedCP');
    if (savedCP) {
      setNumeroCP(savedCP);
      setRememberCP(true);
      // Vérifier si cet utilisateur a un PIN
      checkUserHasPin(savedCP);
    }
  }, []);

  // Fonction pour vérifier si l'utilisateur a un PIN
  const checkUserHasPin = async (cp) => {
    try {
      const { data: userData, error } = await supabase
        .from('utilisateurs')
        .select('code_pin')
        .eq('numero_cp', cp.trim().toUpperCase())
        .single();

      if (!error && userData && userData.code_pin) {
        setUserHasPin(true);
        setShowPinLogin(true); // Afficher par défaut la connexion PIN
      } else {
        setUserHasPin(false);
        setShowPinLogin(false); // Afficher par défaut la connexion classique
      }
    } catch (error) {
      setUserHasPin(false);
      setShowPinLogin(false);
    }
  };

  // Vérifier le PIN quand le numéro CP change
  useEffect(() => {
    if (numeroCP.trim()) {
      checkUserHasPin(numeroCP.trim());
    } else {
      setUserHasPin(false);
      setShowPinLogin(false);
    }
  }, [numeroCP]);

  // 1. Effet pour la vérification de la session au démarrage
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Erreur lors de la vérification de session:', error);
          setAuthLoading(false);
          return;
        }

        if (session?.user) {
          const { data: userData, error: userError } = await supabase
            .from('utilisateurs')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (userError) {
            console.error('Erreur lors de la récupération des données utilisateur:', userError);
            await supabase.auth.signOut();
            return;
          }

          if (userData) {
            if (userData.statut === 'bloque') {
              showNotif('Votre compte est bloqué. Contactez un administrateur.', true);
              await supabase.auth.signOut();
              return;
            }

            // Vérifier si l'utilisateur a un code PIN
            if (!userData.code_pin) {
              setCurrentUser({
                id: userData.id,
                nom: userData.nom,
                profil: userData.profil,
                numeroCP: userData.numero_cp,
                statut: userData.statut
              });
              setCurrentView('setup-pin');
              setAuthLoading(false);
              return;
            }

            await supabase
              .from('utilisateurs')
              .update({ 
                derniere_connexion: new Date().toISOString(),
                tentatives_echouees: 0 
              })
              .eq('id', session.user.id);

            setCurrentUser({
              id: userData.id,
              nom: userData.nom,
              profil: userData.profil,
              numeroCP: userData.numero_cp,
              statut: userData.statut,
              hasPin: !!userData.code_pin
            });
            setIsLoggedIn(true);
            setCurrentView('dashboard');
            showNotif(`Bienvenue ${userData.nom}!`);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'état d\'authentification:', error);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuthState();
  }, []);

  // 2. Effet pour le chargement des données après une connexion réussie
  useEffect(() => {
    const loadFullData = async () => {
      setLoading(true);
      try {
        console.log('Chargement des données depuis Supabase...');
        
        const { data: articlesData, error: articlesError } = await supabase.from('articles').select('*').order('symbole');
        if (articlesError) throw articlesError;

        const transformedArticles = (articlesData || []).map(article => ({
          id: article.id,
          symbole: String(article.symbole || ''),
          designation: String(article.designation || 'Désignation non définie'),
          natureDepot: String(article.nature_depot || ''),
          localisation: String(article.localisation || ''),
          rack: String(article.rack || ''),
          niveau: String(article.niveau || ''),
          emplacement: String(article.emplacement || ''),
          commentaire: String(article.commentaire || '')
        }));
        setArticles(transformedArticles);
        
        if (currentUser?.profil === 'administrateur') {
          const { data: usersData, error: usersError } = await supabase.from('utilisateurs').select('*').order('nom');
          if (usersError) {
            console.error('Erreur lors du chargement des utilisateurs:', usersError);
          } else {
            const transformedUsers = {};
            (usersData || []).forEach(user => {
              transformedUsers[user.numero_cp] = {
                id: user.id,
                nom: user.nom,
                profil: user.profil,
                statut: user.statut,
                derniereConnexion: user.derniere_connexion,
                tentativesEchouees: user.tentatives_echouees || 0,
                dateCreation: user.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
                hasPin: !!user.code_pin
              };
            });
            setUsers(transformedUsers);
          }
        }
        showNotif(`✅ Données chargées: ${transformedArticles.length} articles`);
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        showNotif('Erreur lors du chargement des données: ' + handleSupabaseError(error), true);
      }
      setLoading(false);
    };

    if (isLoggedIn) {
      loadFullData();
    }
  }, [isLoggedIn, currentUser]);

  // Fonctions utilitaires
  const showNotif = (message, isError = false) => {
    setNotification({ message, isError });
    setTimeout(() => setNotification(''), 3000);
  };

  // Helper pour vérifier les profils
  const hasRole = (role) => {
    return currentUser?.profil?.toLowerCase() === role.toLowerCase();
  };

  const isAdmin = () => hasRole('administrateur');
  const isManager = () => hasRole('gestionnaire');

  const normalizeCode = (code) => {
    if (!code) return '';
    return code.replace(/^0+/, '') || '0';
  };

  const highlightSearchTerm = (text, searchTerm) => {
    if (!searchTerm || !text) return text;
    
    try {
      const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const parts = text.split(regex);
      
      return parts.map((part, index) => 
        regex.test(part) ? 
          React.createElement('span', { 
            key: index, 
            className: "bg-yellow-200 text-yellow-900 px-1 rounded" 
          }, part) : part
      );
    } catch (error) {
      return text;
    }
  };

  const handleAuthenticatedUser = async (user) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('utilisateurs')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Erreur lors de la récupération des données utilisateur:', userError);
        await supabase.auth.signOut();
        return;
      }

      if (userData) {
        setCurrentUser({
          id: userData.id,
          nom: userData.nom,
          profil: userData.profil,
          numeroCP: userData.numero_cp,
          statut: userData.statut,
          hasPin: !!userData.code_pin
        });

        if (userData.statut === 'bloque') {
          showNotif('Votre compte est bloqué. Contactez un administrateur.', true);
          await supabase.auth.signOut();
          return;
        }

        // Vérifier si l'utilisateur a un code PIN
        if (!userData.code_pin) {
          setCurrentView('setup-pin');
          showNotif('Veuillez créer votre code PIN pour sécuriser votre compte.');
          return;
        }

        await supabase
          .from('utilisateurs')
          .update({ 
            derniere_connexion: new Date().toISOString(),
            tentatives_echouees: 0 
          })
          .eq('id', user.id);

        setIsLoggedIn(true);
        setCurrentView('dashboard');
        showNotif(`Bienvenue ${userData.nom}!`);
      }
    } catch (error) {
      console.error('Erreur lors de la gestion de l\'utilisateur authentifié:', error);
      await supabase.auth.signOut();
    }
  };

  // === GESTION PIN ===
  const handleSetupPin = async () => {
    if (!newPinCode || newPinCode.length < 4) {
      showNotif('Le code PIN doit contenir au moins 4 chiffres', true);
      return;
    }

    if (newPinCode !== confirmPinCode) {
      showNotif('Les codes PIN ne correspondent pas', true);
      return;
    }

    if (!/^\d+$/.test(newPinCode)) {
      showNotif('Le code PIN ne doit contenir que des chiffres', true);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('utilisateurs')
        .update({ code_pin: newPinCode })
        .eq('id', currentUser.id);

      if (error) throw error;

      setCurrentUser(prev => ({ ...prev, hasPin: true }));
      setNewPinCode('');
      setConfirmPinCode('');
      setIsLoggedIn(true);
      setCurrentView('dashboard');
      showNotif('Code PIN créé avec succès!');
    } catch (error) {
      console.error('Erreur lors de la création du PIN:', error);
      showNotif('Erreur lors de la création du PIN: ' + handleSupabaseError(error), true);
    }
    setLoading(false);
  };

  const handleUpdatePin = async () => {
    if (!newPinCode || newPinCode.length < 4) {
      showNotif('Le nouveau code PIN doit contenir au moins 4 chiffres', true);
      return;
    }

    if (newPinCode !== confirmPinCode) {
      showNotif('Les nouveaux codes PIN ne correspondent pas', true);
      return;
    }

    if (!/^\d+$/.test(newPinCode)) {
      showNotif('Le code PIN ne doit contenir que des chiffres', true);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('utilisateurs')
        .update({ code_pin: newPinCode })
        .eq('id', currentUser.id);

      if (error) throw error;

      setNewPinCode('');
      setConfirmPinCode('');
      showNotif('Code PIN modifié avec succès!');
    } catch (error) {
      console.error('Erreur lors de la modification du PIN:', error);
      showNotif('Erreur lors de la modification du PIN: ' + handleSupabaseError(error), true);
    }
    setLoading(false);
  };

  // === GESTION CONNEXION ===
  const handleLogin = async () => {
    const cp = numeroCP.trim().toUpperCase();
    
    if (!cp || !password) {
      showNotif('Veuillez saisir votre numéro de CP et votre mot de passe', true);
      return;
    }
    
    setLoading(true);
    
    try {
      const email = createEmailFromCP(cp);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          showNotif('Numéro de CP ou mot de passe incorrect', true);
        } else {
          showNotif('Erreur de connexion: ' + handleSupabaseError(error), true);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        // Gérer la mémorisation du CP
        if (rememberCP) {
          localStorage.setItem('rememberedCP', cp);
        } else {
          localStorage.removeItem('rememberedCP');
        }
        
        await handleAuthenticatedUser(data.user);
      }
      
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      showNotif('Erreur lors de la connexion', true);
    }
    
    setLoading(false);
  };

  const handlePinLogin = async () => {
    const cp = numeroCP.trim().toUpperCase();
    
    if (!cp) {
      showNotif('Veuillez saisir votre numéro de CP', true);
      return;
    }
    
    if (!pinCode || pinCode.length < 4) {
      showNotif('Veuillez saisir votre code PIN', true);
      return;
    }

    if (!/^\d+$/.test(pinCode)) {
      showNotif('Le code PIN ne doit contenir que des chiffres', true);
      return;
    }

    setLoading(true);
    try {
      const { data: userData, error } = await supabase
        .from('utilisateurs')
        .select('*')
        .eq('numero_cp', cp)
        .eq('code_pin', pinCode)
        .single();

      if (error || !userData) {
        showNotif('Code PIN incorrect', true);
        setLoading(false);
        return;
      }

      if (userData.statut === 'bloque') {
        showNotif('Votre compte est bloqué. Contactez un administrateur.', true);
        setLoading(false);
        return;
      }

      // Gérer la mémorisation du CP
      if (rememberCP) {
        localStorage.setItem('rememberedCP', cp);
      } else {
        localStorage.removeItem('rememberedCP');
      }

      // Connexion directe avec les données utilisateur
      await supabase
        .from('utilisateurs')
        .update({ 
          derniere_connexion: new Date().toISOString(),
          tentatives_echouees: 0 
        })
        .eq('id', userData.id);

      setCurrentUser({
        id: userData.id,
        nom: userData.nom,
        profil: userData.profil,
        numeroCP: userData.numero_cp,
        statut: userData.statut,
        hasPin: true
      });

      setIsLoggedIn(true);
      setCurrentView('dashboard');
      showNotif(`Bienvenue ${userData.nom}!`);
      
    } catch (error) {
      console.error('Erreur lors de la connexion PIN:', error);
      showNotif('Erreur lors de la connexion', true);
    }
    setLoading(false);
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setIsLoggedIn(false);
      setCurrentUser(null);
      setCurrentView('login');
      
      // Ne pas effacer le CP s'il est mémorisé
      if (!rememberCP) {
        setNumeroCP('');
      }
      
      setPassword('');
      setPinCode('');
      setShowPinLogin(false);
      setSidebarOpen(false);
      setCurrentPage(1);
      setSearchTerm('');
      setFilters({ natureDepot: '', localisation: '' });
      setArticles([]);
      setUsers({});
      showNotif('Déconnecté');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      showNotif('Erreur lors de la déconnexion', true);
    }
  };

  // === GESTION ARTICLES ===
  const handleSaveArticle = async () => {
    if (!formData.symbole || !formData.localisation) {
      showNotif('Veuillez remplir tous les champs obligatoires (Symbole et Localisation)', true);
      return;
    }

    setLoading(true);
    
    try {
      const articleData = {
        symbole: formData.symbole,
        designation: formData.designation || 'Désignation non définie',
        nature_depot: formData.natureDepot || null,
        localisation: formData.localisation,
        rack: formData.rack || null,
        niveau: formData.niveau || null,
        emplacement: formData.emplacement || null,
        commentaire: formData.commentaire || null
      };

      if (selectedArticle) {
        const { error } = await supabase
          .from('articles')
          .update(articleData)
          .eq('id', selectedArticle.id);

        if (error) throw error;

        setArticles(prev => prev.map(a => 
          a.id === selectedArticle.id 
            ? {...formData, id: selectedArticle.id}
            : a
        ));
        showNotif('Article modifié avec succès');
      } else {
        const { data, error } = await supabase
          .from('articles')
          .insert([articleData])
          .select()
          .single();

        if (error) throw error;

        const newArticle = {
          id: data.id,
          symbole: data.symbole,
          designation: data.designation,
          natureDepot: data.nature_depot,
          localisation: data.localisation,
          rack: data.rack,
          niveau: data.niveau,
          emplacement: data.emplacement,
          commentaire: data.commentaire
        };

        setArticles(prev => [...prev, newArticle]);
        showNotif('Article créé avec succès');
      }
      
      setCurrentView('search-articles');
      setSelectedArticle(null);
      setFormData({});
      
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      showNotif('Erreur lors de la sauvegarde: ' + handleSupabaseError(error), true);
    }
    
    setLoading(false);
  };

  const handleDeleteArticle = async (articleId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet article ?")) {
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', articleId);

      if (error) throw error;

      setArticles(prev => prev.filter(a => a.id !== articleId));
      showNotif('Article supprimé avec succès');
      
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showNotif('Erreur lors de la suppression: ' + handleSupabaseError(error), true);
    }
    
    setLoading(false);
  };

  const handleProfileChange = (cp, newProfile) => {
    setEditedUsers(prev => ({
      ...prev,
      [cp]: newProfile
    }));
  };

  const handleSaveProfile = async (cp, userId) => {
    if (!isAdmin()) {
      showNotif("Vous n'avez pas les droits pour effectuer cette action.", true);
      return;
    }

    const newProfile = editedUsers[cp];
    if (!newProfile) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('utilisateurs')
        .update({ profil: newProfile })
        .eq('id', userId);

      if (error) throw error;

      setUsers(prevUsers => {
        const updatedUsers = { ...prevUsers };
        updatedUsers[cp].profil = newProfile;
        return updatedUsers;
      });

      setEditedUsers(prev => {
        const newEdited = { ...prev };
        delete newEdited[cp];
        return newEdited;
      });
      
      showNotif('Profil de l\'utilisateur mis à jour avec succès !');

    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      showNotif('Erreur: ' + handleSupabaseError(error), true);
    }
    setLoading(false);
  };

  // Constantes dynamiques
  const localisations = useMemo(() => {
    const locs = [...new Set(articles.map(a => a.localisation).filter(Boolean))];
    return locs.length > 0 ? locs : ["Porte de Buc", "Matelots", "Plaisir"];
  }, [articles]);
  
  const naturesDepot = useMemo(() => {
    const natures = [...new Set(articles.map(a => a.natureDepot).filter(Boolean))];
    return natures.length > 0 ? natures : ["BDL", "SR"];
  }, [articles]);

  // Statistiques
  const stats = useMemo(() => {
    return {
      totalArticles: articles.length,
      totalUsers: Object.keys(users).length,
      usersActifs: Object.values(users).filter(u => u.statut === 'actif').length,
      usersBloqués: Object.values(users).filter(u => u.statut === 'bloque').length,
      usersWithPin: Object.values(users).filter(u => u.hasPin).length,
      parLocalisation: localisations.reduce((acc, loc) => {
        acc[loc] = articles.filter(a => a.localisation === loc).length;
        return acc;
      }, {}),
      parNatureDepot: naturesDepot.reduce((acc, nature) => {
        acc[nature] = articles.filter(a => a.natureDepot === nature).length;
        return acc;
      }, {})
    };
  }, [articles, users, localisations, naturesDepot]);

  // Recherche et filtrage
  const filteredArticles = useMemo(() => {
    let filtered = articles;

    if (filters.natureDepot) {
      filtered = filtered.filter(a => a.natureDepot && String(a.natureDepot).toLowerCase() === filters.natureDepot.toLowerCase());
    }
    if (filters.localisation) {
      filtered = filtered.filter(a => a.localisation && String(a.localisation).toLowerCase() === filters.localisation.toLowerCase());
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase().trim();
      const normalizedSearchTerm = normalizeCode(searchTerm);
      
      filtered = filtered.filter(article => {
        const symbole = String(article.symbole || '').toLowerCase();
        const normalizedSymbole = normalizeCode(article.symbole || '');
        const designation = String(article.designation || '').toLowerCase();
        const rack = String(article.rack || '').toLowerCase();
        const niveau = String(article.niveau || '').toLowerCase();
        const emplacement = String(article.emplacement || '').toLowerCase();
        const commentaire = String(article.commentaire || '').toLowerCase();
        const localisation = String(article.localisation || '').toLowerCase();
        const natureDepot = String(article.natureDepot || '').toLowerCase();

        return symbole.includes(searchLower) ||
               normalizedSymbole.includes(normalizedSearchTerm) ||
               designation.includes(searchLower) ||
               rack.includes(searchLower) ||
               niveau.includes(searchLower) ||
               emplacement.includes(searchLower) ||
               commentaire.includes(searchLower) ||
               localisation.includes(searchLower) ||
               natureDepot.includes(searchLower);
      });
    }

    return filtered;
  }, [articles, searchTerm, filters]);

  // Pagination
  const totalPages = Math.ceil(filteredArticles.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentArticles = filteredArticles.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters]);

  // Export des données
  const exportData = () => {
    try {
      // Créer un nouveau classeur
      const workbook = XLSX.utils.book_new();
      
      // === FEUILLE ARTICLES ===
      const articlesForExport = articles.map(article => ({
        'Symbole': article.symbole || '',
        'Désignation': article.designation || '',
        'Nature du dépôt': article.natureDepot || '',
        'Localisation': article.localisation || '',
        'Rack': article.rack || '',
        'Niveau': article.niveau || '',
        'Emplacement': article.emplacement || '',
        'Commentaire': article.commentaire || ''
      }));
      
      const articlesSheet = XLSX.utils.json_to_sheet(articlesForExport);
      
      // Définir la largeur des colonnes
      const articleColWidths = [
        { wch: 15 }, // Symbole
        { wch: 40 }, // Désignation
        { wch: 15 }, // Nature du dépôt
        { wch: 20 }, // Localisation
        { wch: 10 }, // Rack
        { wch: 10 }, // Niveau
        { wch: 15 }, // Emplacement
        { wch: 30 }  // Commentaire
      ];
      articlesSheet['!cols'] = articleColWidths;
      
      XLSX.utils.book_append_sheet(workbook, articlesSheet, 'Articles');
      
      // === FEUILLE UTILISATEURS (seulement pour admin) ===
      if (isAdmin() && Object.keys(users).length > 0) {
        const usersForExport = Object.entries(users).map(([cp, user]) => ({
          'Numéro CP': cp,
          'Nom': user.nom || '',
          'Profil': user.profil || '',
          'Statut': user.statut || '',
          'Code PIN': user.hasPin ? 'Oui' : 'Non',
          'Dernière connexion': user.derniereConnexion 
            ? new Date(user.derniereConnexion).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'Jamais',
          'Date de création': user.dateCreation 
            ? new Date(user.dateCreation).toLocaleDateString('fr-FR')
            : ''
        }));
        
        const usersSheet = XLSX.utils.json_to_sheet(usersForExport);
        
        const userColWidths = [
          { wch: 12 }, // Numéro CP
          { wch: 25 }, // Nom
          { wch: 15 }, // Profil
          { wch: 10 }, // Statut
          { wch: 10 }, // Code PIN
          { wch: 20 }, // Dernière connexion
          { wch: 15 }  // Date de création
        ];
        usersSheet['!cols'] = userColWidths;
        
        XLSX.utils.book_append_sheet(workbook, usersSheet, 'Utilisateurs');
      }
      
      // === FEUILLE STATISTIQUES ===
      const statsData = [
        ['STATISTIQUES GÉNÉRALES', ''],
        ['Total des articles', stats.totalArticles],
        ['Nombre de localisations', localisations.length],
        ['Types de dépôts', naturesDepot.length],
        ...(isAdmin() ? [
          ['Total utilisateurs', stats.totalUsers],
          ['Utilisateurs actifs', stats.usersActifs],
          ['Utilisateurs bloqués', stats.usersBloqués],
          ['Utilisateurs avec PIN', stats.usersWithPin]
        ] : []),
        ['', ''], // Ligne vide
        ['RÉPARTITION PAR LOCALISATION', ''],
        ...localisations.map(loc => [loc, stats.parLocalisation[loc] || 0]),
        ['', ''], // Ligne vide
        ['RÉPARTITION PAR NATURE DE DÉPÔT', ''],
        ...Object.entries(stats.parNatureDepot).map(([nature, count]) => [nature, count]),
        ['', ''], // Ligne vide
        ['INFORMATIONS D\'EXPORT', ''],
        ['Date d\'export', new Date().toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })],
        ['Exporté par', currentUser?.nom || 'Utilisateur inconnu'],
        ['Version', '1.0.0']
      ];
      
      const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
      
      // Style pour les en-têtes
      const statsColWidths = [
        { wch: 30 }, // Libellé
        { wch: 15 }  // Valeur
      ];
      statsSheet['!cols'] = statsColWidths;
      
      XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistiques');
      
      // === FEUILLE RÉPARTITION (graphique sous forme de tableau) ===
      const repartitionData = [
        ['RÉPARTITION DÉTAILLÉE', '', '', ''],
        ['', '', '', ''],
        ['LOCALISATIONS', 'Nombre d\'articles', 'Pourcentage', 'Graphique'],
        ...localisations.map(loc => {
          const count = stats.parLocalisation[loc] || 0;
          const percentage = stats.totalArticles > 0 ? Math.round((count / stats.totalArticles) * 100) : 0;
          const bar = '█'.repeat(Math.floor(percentage / 5)); // Graphique ASCII
          return [loc, count, `${percentage}%`, bar];
        }),
        ['', '', '', ''],
        ['NATURES DE DÉPÔT', 'Nombre d\'articles', 'Pourcentage', 'Graphique'],
        ...Object.entries(stats.parNatureDepot).map(([nature, count]) => {
          const percentage = stats.totalArticles > 0 ? Math.round((count / stats.totalArticles) * 100) : 0;
          const bar = '█'.repeat(Math.floor(percentage / 5));
          return [nature, count, `${percentage}%`, bar];
        })
      ];
      
      const repartitionSheet = XLSX.utils.aoa_to_sheet(repartitionData);
      
      const repartitionColWidths = [
        { wch: 20 }, // Nom
        { wch: 15 }, // Nombre
        { wch: 12 }, // Pourcentage
        { wch: 25 }  // Graphique
      ];
      repartitionSheet['!cols'] = repartitionColWidths;
      
      XLSX.utils.book_append_sheet(workbook, repartitionSheet, 'Répartition');
      
      // Générer le fichier
      const fileName = `inventaire_vch_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      showNotif(`📊 Export Excel généré avec succès! (${stats.totalArticles} articles exportés)`);
      
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      showNotif('❌ Erreur lors de la génération du fichier Excel', true);
    }
  };

  // =================== INTERFACES ===================

  // Écran de chargement de l'authentification
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-lg w-full">
          <div className="mb-8">
            <svg 
              viewBox="0 0 400 300" 
              className="w-80 h-60 mx-auto"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="400" height="300" fill="#f8fafc"/>
              <text x="200" y="40" textAnchor="middle" className="fill-red-600 text-2xl font-bold" style={{fontSize: '24px', fontWeight: 'bold'}}>
                Caténaires
              </text>
              <rect x="280" y="60" width="12" height="180" fill="#6b7280"/>
              <rect x="275" y="235" width="22" height="15" fill="#6b7280"/>
              <rect x="240" y="100" width="60" height="8" fill="#374151"/>
              <rect x="240" y="130" width="60" height="8" fill="#374151"/>
              <line x1="80" y1="120" x2="240" y2="100" stroke="#f97316" strokeWidth="4"/>
              <line x1="80" y1="150" x2="240" y2="130" stroke="#f97316" strokeWidth="4"/>
              <line x1="260" y1="100" x2="200" y2="80" stroke="#374151" strokeWidth="3"/>
              <line x1="260" y1="130" x2="200" y2="110" stroke="#374151" strokeWidth="3"/>
              <ellipse cx="200" cy="160" rx="8" ry="15" fill="#d1d5db"/>
              <rect x="196" y="175" width="8" height="20" fill="#9ca3af"/>
              <rect x="180" y="210" width="40" height="15" fill="#e5e7eb"/>
              <line x1="200" y1="195" x2="200" y2="210" stroke="#1f2937" strokeWidth="3"/>
              <line x1="190" y1="195" x2="210" y2="195" stroke="#1f2937" strokeWidth="4"/>
              <line x1="200" y1="175" x2="200" y2="195" stroke="#1f2937" strokeWidth="2"/>
              <text x="200" y="280" textAnchor="middle" className="fill-blue-600 text-2xl font-bold" style={{fontSize: '24px', fontWeight: 'bold'}}>
                Versailles
              </text>
            </svg>
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Chargement...</h2>
          
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
            <span className="text-gray-600">Vérification de la session</span>
          </div>
        </div>
      </div>
    );
  }

  // Configuration du PIN
  if (currentView === 'setup-pin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Sécuriser votre compte</h1>
            <p className="text-gray-600 mt-2">Créez un code PIN pour des connexions rapides</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nouveau code PIN (4 chiffres minimum) *</label>
              <input
                type="password"
                value={newPinCode}
                onChange={(e) => setNewPinCode(e.target.value.replace(/\D/g, ''))}
                maxLength="6"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-center text-lg tracking-widest"
                placeholder="••••"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirmer le code PIN *</label>
              <input
                type="password"
                value={confirmPinCode}
                onChange={(e) => setConfirmPinCode(e.target.value.replace(/\D/g, ''))}
                maxLength="6"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-center text-lg tracking-widest"
                placeholder="••••"
                disabled={loading}
              />
            </div>

            <button
              onClick={handleSetupPin}
              disabled={loading || !newPinCode || !confirmPinCode}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Création...</span>
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  <span>Créer mon code PIN</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-gray-500">
            <div className="bg-green-50 rounded-lg p-3">
              <p className="font-medium text-green-900 mb-2">🔐 Connexion sécurisée</p>
              <p className="text-green-800">Votre code PIN vous permettra de vous connecter rapidement tout en maintenant la sécurité</p>
            </div>
          </div>
        </div>

        {notification && (
          <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg text-white z-50 shadow-lg transform transition-transform ${
            notification.isError ? 'bg-red-500' : 'bg-green-500'
          }`}>
            <div className="flex items-center space-x-2">
              {notification.isError ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
              <span>{notification.message}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Page de connexion
  if (currentView === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Localisation Stock Caténaires VCH</h1>
            <p className="text-gray-600 mt-2">Gestion de Stock Caténaires Versailles</p>
          </div>

          {!showPinLogin ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Numéro de CP *</label>
                <input
                  type="text"
                  value={numeroCP}
                  onChange={(e) => setNumeroCP(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Ex: 7408443F"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe *</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Votre mot de passe sécurisé"
                  disabled={loading}
                />
              </div>

              {/* Case à cocher pour mémoriser l'identifiant */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="rememberCP"
                  checked={rememberCP}
                  onChange={(e) => setRememberCP(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="rememberCP" className="ml-2 block text-sm text-gray-700">
                  Se souvenir de mon numéro de CP
                </label>
              </div>

              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Connexion...</span>
                  </>
                ) : (
                  <span>Se connecter</span>
                )}
              </button>

              <div className="text-center">
                {userHasPin ? (
                  <button
                    onClick={() => setShowPinLogin(true)}
                    className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center justify-center space-x-2 mx-auto"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Connexion rapide avec code PIN</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setShowPinLogin(true)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center justify-center space-x-2 mx-auto"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Connexion avec code PIN</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Numéro de CP *</label>
                <input
                  type="text"
                  value={numeroCP}
                  onChange={(e) => setNumeroCP(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Ex: 7408443F"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code PIN *
                  {userHasPin && (
                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      ✓ PIN configuré
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handlePinLogin()}
                  maxLength="6"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-center text-lg tracking-widest"
                  placeholder="••••"
                  disabled={loading}
                />
              </div>

              {/* Case à cocher pour mémoriser l'identifiant */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="rememberCPPin"
                  checked={rememberCP}
                  onChange={(e) => setRememberCP(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="rememberCPPin" className="ml-2 block text-sm text-gray-700">
                  Se souvenir de mon numéro de CP
                </label>
              </div>

              <button
                onClick={handlePinLogin}
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-xl hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Connexion...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-5 h-5" />
                    <span>Se connecter avec PIN</span>
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  onClick={() => setShowPinLogin(false)}
                  className="text-gray-600 hover:text-gray-800 text-sm flex items-center justify-center space-x-2 mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Connexion avec mot de passe</span>
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 text-center text-sm text-gray-500">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="font-medium text-blue-900 mb-2">🔐 Système d'authentification sécurisé</p>
              <p className="text-blue-800">Utilise Supabase Auth avec chiffrement des données</p>
            </div>
          </div>
        </div>

        {notification && (
          <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg text-white z-50 shadow-lg transform transition-transform ${
            notification.isError ? 'bg-red-500' : 'bg-green-500'
          }`}>
            <div className="flex items-center space-x-2">
              {notification.isError ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
              <span>{notification.message}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Application principale avec interface complète
  if (isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 lg:hidden transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Localisation Stock Caténaires VCH</h1>
                  <p className="text-xs text-gray-500">
                    📊 {stats.totalArticles} articles • Supabase ✅
                    {currentUser?.hasPin && <span className="ml-2">🔐 PIN</span>}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {isAdmin() && (
                <button
                  onClick={exportData}
                  className="hidden sm:flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Exporter en Excel"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Excel</span>
                </button>
              )}
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-900">{currentUser?.nom}</p>
                <p className="text-xs text-gray-500 capitalize">
                  <>
                    {currentUser?.profil}
                    {' '}
                    <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs">
                      {currentUser?.profil === 'administrateur' ? '🛡️ ADMIN' : 
                       currentUser?.profil === 'gestionnaire' ? '👔 GEST' : '📋 CONS'}
                    </span>
                  </>
                </p>
              </div>
              <button
                onClick={logout}
                className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar */}
          <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform lg:translate-x-0 lg:static lg:inset-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
            <div className="flex items-center justify-between p-4 border-b lg:hidden">
              <span className="text-lg font-semibold">Menu</span>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <nav className="p-4 space-y-2">
              {[
                { id: 'dashboard', label: 'Tableau de bord', icon: Home, color: 'text-blue-600' },
                ...(isAdmin() || isManager() ? [{
                  id: 'create-article', 
                  label: 'Créer un article', 
                  icon: Plus, 
                  color: 'text-green-600',
                  action: () => {
                    setSelectedArticle(null); 
                    setFormData({
                      symbole: '',
                      designation: '',
                      natureDepot: '',
                      localisation: '',
                      rack: '',
                      niveau: '',
                      emplacement: '',
                      commentaire: ''
                    });
                  }
                }] : []),
                { id: 'search-articles', label: 'Rechercher articles', icon: Search, color: 'text-purple-600' },
                { id: 'stats', label: 'Statistiques', icon: TrendingUp, color: 'text-indigo-600' },
                { id: 'settings', label: 'Paramètres', icon: Settings, color: 'text-orange-600' }
              ]
              .concat(
                isAdmin() ? 
                [{
                  id: 'users', 
                  label: 'Gestion utilisateurs', 
                  icon: Users, 
                  color: 'text-red-600'
                }] : []
              )
              .map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.action) item.action();
                      setCurrentView(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                      isActive 
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600 shadow-sm' 
                        : 'hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : item.color}`} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Info utilisateur */}
            <div className="p-3 mt-4 bg-green-50 border-t border-green-200">
              <p className="text-xs font-bold text-green-800 mb-1">✅ Session active :</p>
              <div className="text-xs text-green-700">
                <p><strong>{currentUser?.nom}</strong> ({currentUser?.profil})</p>
                <p>CP: {currentUser?.numeroCP}</p>
                {currentUser?.hasPin && (
                  <p className="flex items-center mt-1">
                    <KeyRound className="w-3 h-3 mr-1" />
                    Code PIN configuré
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Overlay pour fermer le sidebar */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Contenu principal */}
          <main className="flex-1 p-4 lg:p-8">
            {/* Formulaire de création/édition d'article */}
            {currentView === 'create-article' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">
                      {selectedArticle ? 'Modifier l\'article' : 'Créer un nouvel article'}
                    </h2>
                    <p className="text-gray-600 mt-1">
                      {selectedArticle ? 'Modifiez les informations de l\'article' : 'Ajoutez un nouvel article à l\'inventaire'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCurrentView('search-articles');
                      setSelectedArticle(null);
                      setFormData({});
                    }}
                    className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Retour</span>
                  </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                        <span>🏷️</span>
                        <span>Symbole *</span>
                      </label>
                      <input
                        type="text"
                        value={formData.symbole || ''}
                        onChange={(e) => setFormData(prev => ({...prev, symbole: e.target.value}))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="Ex: 08811305"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                        <span>📝</span>
                        <span>Désignation</span>
                      </label>
                      <input
                        type="text"
                        value={formData.designation || ''}
                        onChange={(e) => setFormData(prev => ({...prev, designation: e.target.value}))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="Description de l'article"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                        <span>🏪</span>
                        <span>Nature du dépôt</span>
                      </label>
                      <select
                        value={formData.natureDepot || ''}
                        onChange={(e) => setFormData(prev => ({...prev, natureDepot: e.target.value}))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      >
                        <option value="">Sélectionner...</option>
                        {naturesDepot.map(nature => (
                          <option key={nature} value={nature}>{nature}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                        <span>📍</span>
                        <span>Localisation *</span>
                      </label>
                      <select
                        value={formData.localisation || ''}
                        onChange={(e) => setFormData(prev => ({...prev, localisation: e.target.value}))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        required
                      >
                        <option value="">Sélectionner...</option>
                        {localisations.map(loc => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                        <span>🗄️</span>
                        <span>Rack</span>
                      </label>
                      <input
                        type="text"
                        value={formData.rack || ''}
                        onChange={(e) => setFormData(prev => ({...prev, rack: e.target.value}))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="Ex: A"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                        <span>📏</span>
                        <span>Niveau</span>
                      </label>
                      <input
                        type="text"
                        value={formData.niveau || ''}
                        onChange={(e) => setFormData(prev => ({...prev, niveau: e.target.value}))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="Ex: 3"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                        <span>🎯</span>
                        <span>Emplacement</span>
                      </label>
                      <input
                        type="text"
                        value={formData.emplacement || ''}
                        onChange={(e) => setFormData(prev => ({...prev, emplacement: e.target.value}))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="Ex: 2"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                        <span>💬</span>
                        <span>Commentaire</span>
                      </label>
                      <textarea
                        value={formData.commentaire || ''}
                        onChange={(e) => setFormData(prev => ({...prev, commentaire: e.target.value}))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        rows={3}
                        placeholder="Commentaires particuliers..."
                      />
                    </div>
                  </div>

                  <div className="flex space-x-4 pt-6">
                    <button
                      onClick={handleSaveArticle}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>Enregistrement...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-5 h-5" />
                          <span>{selectedArticle ? 'Mettre à jour' : 'Créer l\'article'}</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setCurrentView('search-articles');
                        setSelectedArticle(null);
                        setFormData({});
                      }}
                      className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                    >
                      <X className="w-5 h-5" />
                      <span>Annuler</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Recherche d'articles */}
            {currentView === 'search-articles' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">Rechercher des articles</h2>
                    <p className="text-gray-600 mt-1">Recherche avancée avec filtres</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setFilters({ natureDepot: '', localisation: '' });
                      }}
                      className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>
                
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                  {/* Barre de recherche */}
                  <div className="mb-6">
                    <div className="flex space-x-4 mb-4">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                          placeholder="Rechercher par symbole, désignation, rack, niveau, emplacement..."
                        />
                      </div>
                      <button
                        onClick={() => {
                          // La recherche est déjà automatique, mais on peut forcer un refresh
                          setCurrentPage(1);
                        }}
                        className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                      >
                        <Search className="w-5 h-5" />
                        <span>Rechercher</span>
                      </button>
                    </div>

                    {/* Filtres */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nature du dépôt</label>
                        <select
                          value={filters.natureDepot}
                          onChange={(e) => setFilters(prev => ({...prev, natureDepot: e.target.value}))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        >
                          <option value="">Toutes les natures</option>
                          {naturesDepot.map(nature => (
                            <option key={nature} value={nature}>{nature}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Localisation</label>
                        <select
                          value={filters.localisation}
                          onChange={(e) => setFilters(prev => ({...prev, localisation: e.target.value}))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        >
                          <option value="">Toutes les localisations</option>
                          {localisations.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Résultats */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        {filteredArticles.length} article{filteredArticles.length > 1 ? 's' : ''} trouvé{filteredArticles.length > 1 ? 's' : ''}
                        {(searchTerm || filters.natureDepot || filters.localisation) && 
                          ` sur ${articles.length} total`
                        }
                      </p>
                    </div>

                    {currentArticles.length > 0 ? (
                      <div className="space-y-3">
                        {currentArticles.map(article => (
                          <div key={article.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow bg-white">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-start space-x-4">
                                  <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                                      {highlightSearchTerm(article.symbole, searchTerm)}
                                    </h3>
                                    <p className="text-gray-700 mb-3 font-medium">
                                      {article.designation && article.designation !== 'Désignation non définie' 
                                        ? highlightSearchTerm(article.designation, searchTerm)
                                        : <span className="text-gray-400 italic">Aucune description</span>
                                      }
                                    </p>
                                    
                                    {/* Informations principales en badges */}
                                    <div className="flex flex-wrap gap-2 mb-3">
                                      <div className="flex items-center space-x-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                                        <span>📍</span>
                                        <span>{highlightSearchTerm(article.localisation, searchTerm)}</span>
                                      </div>
                                      
                                      {article.natureDepot && (
                                        <div className="flex items-center space-x-1 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">
                                          <span>🏪</span>
                                          <span>{highlightSearchTerm(article.natureDepot, searchTerm)}</span>
                                        </div>
                                      )}
                                      
                                      {article.rack && (
                                        <div className="flex items-center space-x-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                                          <span>🗄️</span>
                                          <span>Rack: {highlightSearchTerm(article.rack, searchTerm)}</span>
                                        </div>
                                      )}
                                      
                                      {article.niveau && (
                                        <div className="flex items-center space-x-1 bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-semibold">
                                          <span>📏</span>
                                          <span>Niveau: {highlightSearchTerm(article.niveau, searchTerm)}</span>
                                        </div>
                                      )}
                                      
                                      {article.emplacement && (
                                        <div className="flex items-center space-x-1 bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-semibold">
                                          <span>🎯</span>
                                          <span>Empl.: {highlightSearchTerm(article.emplacement, searchTerm)}</span>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {article.commentaire && (
                                      <div className="bg-gray-50 border-l-4 border-gray-300 p-3 rounded-r-lg">
                                        <p className="text-sm text-gray-700 italic flex items-start space-x-2">
                                          <span className="text-gray-500">💬</span>
                                          <span>{highlightSearchTerm(article.commentaire, searchTerm)}</span>
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {(isAdmin() || isManager()) && (
                                <div className="flex items-center space-x-2 ml-4">
                                  <button
                                    onClick={() => {
                                      setSelectedArticle(article);
                                      setFormData(article);
                                      setCurrentView('create-article');
                                    }}
                                    className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-blue-200 hover:border-blue-300"
                                    title="Modifier"
                                  >
                                    <Edit2 className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteArticle(article.id)}
                                    className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-red-200 hover:border-red-300"
                                    title="Supprimer"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-lg font-medium text-gray-500">Aucun article trouvé</p>
                        <p className="text-sm text-gray-400">
                          {searchTerm || filters.natureDepot || filters.localisation 
                            ? "Essayez de modifier vos critères de recherche"
                            : "Commencez par saisir un terme de recherche"
                          }
                        </p>
                      </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="px-3 py-2 text-sm text-gray-600">
                            Page {currentPage} sur {totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-500">
                          Affichage {startIndex + 1}-{Math.min(endIndex, filteredArticles.length)} sur {filteredArticles.length}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Paramètres */}
            {currentView === 'settings' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">Paramètres</h2>
                    <p className="text-gray-600 mt-1">Configuration de votre compte</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Informations du compte */}
                  <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Settings className="w-5 h-5 mr-2 text-blue-600" />
                      Informations du compte
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">Nom</span>
                        <span className="font-medium text-gray-900">{currentUser?.nom}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">Numéro CP</span>
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">{currentUser?.numeroCP}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">Profil</span>
                        <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                          currentUser?.profil === 'administrateur' ? 'bg-red-100 text-red-800' :
                          currentUser?.profil === 'gestionnaire' ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {currentUser?.profil}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600">Statut</span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center">
                          <Unlock className="w-3 h-3 mr-1" />
                          {currentUser?.statut}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Gestion du code PIN */}
                  <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <KeyRound className="w-5 h-5 mr-2 text-green-600" />
                      Code PIN de sécurité
                    </h3>
                    
                    <div className="space-y-4">
                      {currentUser?.hasPin ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="font-medium text-green-800">Code PIN configuré</span>
                          </div>
                          <p className="text-sm text-green-700">
                            Vous pouvez vous connecter rapidement avec votre code PIN
                          </p>
                        </div>
                      ) : (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <AlertCircle className="w-5 h-5 text-yellow-600" />
                            <span className="font-medium text-yellow-800">Aucun code PIN configuré</span>
                          </div>
                          <p className="text-sm text-yellow-700">
                            Configurez un code PIN pour des connexions plus rapides
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {currentUser?.hasPin ? 'Nouveau code PIN' : 'Code PIN'} (4 chiffres minimum)
                        </label>
                        <input
                          type="password"
                          value={newPinCode}
                          onChange={(e) => setNewPinCode(e.target.value.replace(/\D/g, ''))}
                          maxLength="6"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-center text-lg tracking-widest"
                          placeholder="••••"
                          disabled={loading}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Confirmer le code PIN</label>
                        <input
                          type="password"
                          value={confirmPinCode}
                          onChange={(e) => setConfirmPinCode(e.target.value.replace(/\D/g, ''))}
                          maxLength="6"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-center text-lg tracking-widest"
                          placeholder="••••"
                          disabled={loading}
                        />
                      </div>

                      <button
                        onClick={handleUpdatePin}
                        disabled={loading || !newPinCode || !confirmPinCode || newPinCode.length < 4}
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            <span>Mise à jour...</span>
                          </>
                        ) : (
                          <>
                            <KeyRound className="w-5 h-5" />
                            <span>{currentUser?.hasPin ? 'Modifier le code PIN' : 'Créer le code PIN'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard */}
            {currentView === 'dashboard' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">Tableau de bord</h2>
                    <p className="text-gray-600 mt-1">
                      Vue d'ensemble de votre inventaire
                    </p>
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="flex items-center space-x-2 px-4 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Actualiser les données"
                  >
                    <RefreshCw className="w-5 h-5" />
                    <span className="hidden sm:inline">Actualiser</span>
                  </button>
                </div>

                {/* Actions rapides */}
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-blue-600" />
                    Actions rapides
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(isAdmin() || isManager()) && (
                      <button
                        onClick={() => {
                          setCurrentView('create-article'); 
                          setSelectedArticle(null); 
                          setFormData({
                            symbole: '',
                            designation: '',
                            natureDepot: '',
                            localisation: '',
                            rack: '',
                            niveau: '',
                            emplacement: '',
                            commentaire: ''
                          });
                        }}
                        className="flex items-center space-x-3 px-4 py-3 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all duration-200 transform hover:scale-105"
                      >
                        <Plus className="w-5 h-5 flex-shrink-0" />
                        <span className="font-medium text-sm">Créer un nouvel article</span>
                      </button>
                    )}
                    
                    <button
                      onClick={() => setCurrentView('search-articles')}
                      className="flex items-center space-x-3 px-4 py-3 bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all duration-200 transform hover:scale-105"
                    >
                      <Search className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium text-sm">Rechercher dans {stats.totalArticles} articles</span>
                    </button>

                    <button
                      onClick={() => setCurrentView('stats')}
                      className="flex items-center space-x-3 px-4 py-3 bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-700 rounded-xl hover:from-indigo-100 hover:to-indigo-200 transition-all duration-200 transform hover:scale-105"
                    >
                      <BarChart3 className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium text-sm">Voir les statistiques</span>
                    </button>
                  </div>
                </div>
                
                {/* Cartes de statistiques */}
                <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdmin() ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-6`}>
                  <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total articles</p>
                        <p className="text-3xl font-bold text-blue-600">{stats.totalArticles}</p>
                        <p className="text-xs text-gray-500 mt-1">dans l'inventaire</p>
                      </div>
                      <div className="bg-blue-100 p-3 rounded-xl">
                        <Package className="w-8 h-8 text-blue-600" />
                      </div>
                    </div>
                  </div>
                  
                  {isAdmin() && (
                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Utilisateurs actifs</p>
                          <p className="text-3xl font-bold text-green-600">{stats.usersActifs}</p>
                          <p className="text-xs text-gray-500 mt-1">sur {stats.totalUsers} total</p>
                        </div>
                        <div className="bg-green-100 p-3 rounded-xl">
                          <Users className="w-8 h-8 text-green-600" />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Localisations</p>
                        <p className="text-3xl font-bold text-purple-600">{localisations.length}</p>
                        <p className="text-xs text-gray-500 mt-1">sites actifs</p>
                      </div>
                      <div className="bg-purple-100 p-3 rounded-xl">
                        <MapPin className="w-8 h-8 text-purple-600" />
                      </div>
                    </div>
                  </div>
                  
                  {isAdmin() && (
                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Utilisateurs avec PIN</p>
                          <p className="text-3xl font-bold text-orange-600">{stats.usersWithPin}</p>
                          <p className="text-xs text-gray-500 mt-1">sur {stats.totalUsers} total</p>
                        </div>
                        <div className="bg-orange-100 p-3 rounded-xl">
                          <KeyRound className="w-8 h-8 text-orange-600" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Répartition par localisation */}
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2 text-purple-600" />
                    Répartition par localisation
                  </h3>
                  <div className="space-y-3">
                    {localisations.map(loc => (
                      <div key={loc} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{loc}</span>
                        <div className="flex items-center space-x-3">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500" 
                              style={{width: `${(stats.parLocalisation[loc] / stats.totalArticles) * 100}%`}}
                            />
                          </div>
                          <span className="text-sm font-bold text-gray-900 min-w-[2rem] text-right">{stats.parLocalisation[loc]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Statistiques détaillées */}
            {currentView === 'stats' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">Statistiques détaillées</h2>
                    <p className="text-gray-600 mt-1">Analyse complète de l'inventaire</p>
                  </div>
                  <button
                    onClick={exportData}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exporter en Excel</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Répartition par nature de dépôt */}
                  <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2 text-green-600" />
                      Articles par nature de dépôt
                    </h3>
                    <div className="space-y-4">
                      {Object.entries(stats.parNatureDepot).map(([nature, count]) => (
                        <div key={nature} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-4 h-4 rounded-full ${
                              nature === 'BDL' ? 'bg-green-500' : 'bg-purple-500'
                            }`}></div>
                            <span className="font-medium text-gray-700">{nature}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="w-32 bg-gray-200 rounded-full h-3">
                              <div 
                                className={`h-3 rounded-full transition-all duration-500 ${
                                  nature === 'BDL' ? 'bg-green-500' : 'bg-purple-500'
                                }`}
                                style={{width: `${(count / stats.totalArticles) * 100}%`}}
                              />
                            </div>
                            <span className="text-sm font-bold text-gray-900 min-w-[3rem] text-right">
                              {count} ({Math.round((count / stats.totalArticles) * 100)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Répartition par localisation */}
                  <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                      Articles par localisation
                    </h3>
                    <div className="space-y-4">
                      {Object.entries(stats.parLocalisation).map(([loc, count], index) => (
                        <div key={loc} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-4 h-4 rounded-full ${
                              ['bg-blue-500', 'bg-indigo-500', 'bg-cyan-500'][index % 3]
                            }`}></div>
                            <span className="font-medium text-gray-700">{loc}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="w-32 bg-gray-200 rounded-full h-3">
                              <div 
                                className={`h-3 rounded-full transition-all duration-500 ${
                                  ['bg-blue-500', 'bg-indigo-500', 'bg-cyan-500'][index % 3]
                                }`}
                                style={{width: `${(count / stats.totalArticles) * 100}%`}}
                              />
                            </div>
                            <span className="text-sm font-bold text-gray-900 min-w-[3rem] text-right">
                              {count} ({Math.round((count / stats.totalArticles) * 100)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Informations générales */}
                  <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Activity className="w-5 h-5 mr-2 text-indigo-600" />
                      Informations générales
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">Total des articles</span>
                        <span className="font-bold text-blue-600">{stats.totalArticles}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">Nombre de localisations</span>
                        <span className="font-bold text-purple-600">{localisations.length}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">Types de dépôts</span>
                        <span className="font-bold text-green-600">{naturesDepot.length}</span>
                      </div>
                      {isAdmin() && (
                        <>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-600">Utilisateurs actifs</span>
                            <span className="font-bold text-green-600">{stats.usersActifs}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-600">Utilisateurs avec PIN</span>
                            <span className="font-bold text-orange-600">{stats.usersWithPin}</span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-gray-600">Comptes bloqués</span>
                            <span className="font-bold text-red-600">{stats.usersBloqués}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Gestion des utilisateurs (Administrateur uniquement) */}
            {currentView === 'users' && isAdmin() && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">Gestion des utilisateurs</h2>
                    <p className="text-gray-600 mt-1">Administration des comptes et permissions</p>
                  </div>
                </div>

                {/* Statistiques des utilisateurs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total</p>
                        <p className="text-2xl font-bold text-blue-600">{stats.totalUsers}</p>
                      </div>
                      <Users className="w-8 h-8 text-blue-600" />
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Actifs</p>
                        <p className="text-2xl font-bold text-green-600">{stats.usersActifs}</p>
                      </div>
                      <Unlock className="w-8 h-8 text-green-600" />
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Avec PIN</p>
                        <p className="text-2xl font-bold text-orange-600">{stats.usersWithPin}</p>
                      </div>
                      <KeyRound className="w-8 h-8 text-orange-600" />
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Bloqués</p>
                        <p className="text-2xl font-bold text-red-600">{stats.usersBloqués}</p>
                      </div>
                      <Lock className="w-8 h-8 text-red-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Users className="w-5 h-5 mr-2 text-blue-600" />
                      Liste des utilisateurs ({Object.keys(users).length})
                    </h3>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-left py-3 px-4 font-medium text-gray-600">Utilisateur</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-600">CP</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-600">Profil</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-600">Statut</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-600">PIN</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-600">Dernière connexion</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(users).map(([cp, user]) => (
                            <tr key={cp} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="py-4 px-4">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    user.profil === 'administrateur' ? 'bg-red-100' :
                                    user.profil === 'gestionnaire' ? 'bg-orange-100' : 'bg-blue-100'
                                  }`}>
                                    <span className={`font-medium text-sm ${
                                      user.profil === 'administrateur' ? 'text-red-600' :
                                      user.profil === 'gestionnaire' ? 'text-orange-600' : 'text-blue-600'
                                    }`}>
                                      {user.nom?.charAt(0) || 'U'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-gray-900">{user.nom}</span>
                                    {cp === currentUser?.numeroCP && (
                                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                        Vous
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                                  {cp}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <select
                                  value={editedUsers[cp] || user.profil}
                                  onChange={(e) => handleProfileChange(cp, e.target.value)}
                                  disabled={user.id === currentUser?.id}
                                  className={`px-2 py-1 border rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-400 ${
                                    user.id === currentUser?.id ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300'
                                  }`}
                                >
                                  <option value="consultant">Consultant</option>
                                  <option value="gestionnaire">Gestionnaire</option>
                                  <option value="administrateur">Administrateur</option>
                                </select>
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex items-center space-x-2">
                                  <span className={`text-xs px-2 py-1 rounded-full flex items-center w-fit font-medium ${
                                    user.statut === 'actif' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {user.statut === 'actif' ? <Unlock className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
                                    {user.statut}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex items-center space-x-2">
                                  {user.hasPin ? (
                                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full flex items-center">
                                      <KeyRound className="w-3 h-3 mr-1" />
                                      Configuré
                                    </span>
                                  ) : (
                                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                                      Non configuré
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-4 text-sm">
                                {user.derniereConnexion ? (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-green-500">🕒</span>
                                    <span className="text-gray-700">
                                      {new Date(user.derniereConnexion).toLocaleDateString('fr-FR', {
                                        day: '2-digit',
                                        month: '2-digit', 
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-gray-400">⭕</span>
                                    <span className="text-gray-500">Jamais</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-4">
                                {editedUsers[cp] && (
                                  <button
                                    onClick={() => handleSaveProfile(cp, user.id)}
                                    className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                  >
                                    <Save className="w-4 h-4" />
                                    <span>Enregistrer</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {Object.keys(users).length === 0 && (
                      <div className="text-center py-12">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-lg font-medium text-gray-500">Aucun utilisateur trouvé</p>
                        <p className="text-sm text-gray-400">Les utilisateurs sont gérés via Supabase Authentication</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Notifications */}
        {notification && (
          <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl text-white z-50 shadow-lg transform transition-all duration-300 ${
            notification.isError ? 'bg-red-500' : 'bg-green-500'
          }`}>
            <div className="flex items-center space-x-2">
              {notification.isError ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
              <span className="font-medium">{notification.message}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default InventoryManagementApp;
