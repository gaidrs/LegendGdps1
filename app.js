class GlobalList {
    constructor() {
        this.loadData();
        
        // Если нет данных, инициализируем систему
        if (!this.data) {
            this.initializeSystem();
        }
        
        // Текущий пользователь
        this.currentUser = null;
        
        // Выбранное изменение для модерации
        this.selectedChange = null;
        
        // Инициализация интерфейса
        this.initUI();
    }
    
    loadData() {
        const savedData = localStorage.getItem('globalListData');
        this.data = savedData ? JSON.parse(savedData) : null;
        this.pendingChanges = [];
    }
    
    saveData() {
        localStorage.setItem('globalListData', JSON.stringify(this.data));
    }
    
    initializeSystem() {
        this.data = {
            approvedItems: [],
            changeHistory: [],
            users: {},
            settings: {
                adminUsername: 'Gaidrs'
            }
        };
        this.saveData();
    }
    
    registerUser(username, password) {
        if (this.data.users[username]) {
            return { success: false, message: 'Имя пользователя уже занято' };
        }
        
        const isAdmin = username === this.data.settings.adminUsername;
        
        this.data.users[username] = {
            password: password, // В реальном приложении нужно хешировать!
            role: isAdmin ? 'owner' : 'user',
            registrationDate: new Date().toISOString(),
            lastLogin: null
        };
        
        this.saveData();
        
        return { 
            success: true, 
            message: isAdmin ? 'Зарегистрирован как владелец!' : 'Регистрация успешна',
            isOwner: isAdmin
        };
    }
    
    loginUser(username, password) {
        const user = this.data.users[username];
        
        if (!user || user.password !== password) {
            return { success: false, message: 'Неверные учетные данные' };
        }
        
        user.lastLogin = new Date().toISOString();
        this.currentUser = {
            username: username,
            role: user.role,
            isOwner: user.role === 'owner'
        };
        this.saveData();
        
        return { 
            success: true, 
            role: user.role,
            isOwner: user.role === 'owner'
        };
    }
    
    logoutUser() {
        this.currentUser = null;
    }
    
    addItem(item, username) {
        if (!this.data.users[username]) {
            return { success: false, message: 'Пользователь не найден' };
        }
        
        const changeId = Date.now();
        this.pendingChanges.push({
            id: changeId,
            type: 'add',
            item: item,
            username: username,
            timestamp: new Date().toISOString(),
            status: 'pending'
        });
        
        return { success: true, changeId };
    }
    
    editItem(itemId, newValue, username) {
        if (!this.data.users[username]) {
            return { success: false, message: 'Пользователь не найден' };
        }
        
        if (itemId < 0 || itemId >= this.data.approvedItems.length) {
            return { success: false, message: 'Неверный ID элемента' };
        }
        
        const changeId = Date.now();
        this.pendingChanges.push({
            id: changeId,
            type: 'edit',
            itemId: itemId,
            oldValue: this.data.approvedItems[itemId],
            newValue: newValue,
            username: username,
            timestamp: new Date().toISOString(),
            status: 'pending'
        });
        
        return { success: true, changeId };
    }
    
    deleteItem(itemId, username) {
        if (!this.data.users[username]) {
            return { success: false, message: 'Пользователь не найден' };
        }
        
        if (itemId < 0 || itemId >= this.data.approvedItems.length) {
            return { success: false, message: 'Неверный ID элемента' };
        }
        
        const changeId = Date.now();
        this.pendingChanges.push({
            id: changeId,
            type: 'delete',
            itemId: itemId,
            oldValue: this.data.approvedItems[itemId],
            username: username,
            timestamp: new Date().toISOString(),
            status: 'pending'
        });
        
        return { success: true, changeId };
    }
    
    getApprovedItems() {
        return [...this.data.approvedItems];
    }
    
    getPendingChanges() {
        return [...this.pendingChanges];
    }
    
    approveChange(changeId, moderatorUsername) {
        const moderator = this.data.users[moderatorUsername];
        if (!moderator || (moderator.role !== 'moderator' && moderator.role !== 'owner')) {
            return { success: false, message: 'Требуются права модератора' };
        }
        
        const changeIndex = this.pendingChanges.findIndex(c => c.id === changeId);
        if (changeIndex === -1) {
            return { success: false, message: 'Изменение не найдено' };
        }
        
        const change = this.pendingChanges[changeIndex];
        
        // Применяем изменение
        switch (change.type) {
            case 'add':
                this.data.approvedItems.push(change.item);
                break;
            case 'edit':
                this.data.approvedItems[change.itemId] = change.newValue;
                break;
            case 'delete':
                this.data.approvedItems.splice(change.itemId, 1);
                break;
        }
        
        // Записываем в историю
        this.data.changeHistory.push({
            ...change,
            moderator: moderatorUsername,
            actionDate: new Date().toISOString(),
            status: 'approved'
        });
        
        // Удаляем из ожидающих
        this.pendingChanges.splice(changeIndex, 1);
        
        this.saveData();
        
        return { success: true };
    }
    
    rejectChange(changeId, moderatorUsername, reason) {
        const moderator = this.data.users[moderatorUsername];
        if (!moderator || (moderator.role !== 'moderator' && moderator.role !== 'owner')) {
            return { success: false, message: 'Требуются права модератора' };
        }
        
        const changeIndex = this.pendingChanges.findIndex(c => c.id === changeId);
        if (changeIndex === -1) {
            return { success: false, message: 'Изменение не найдено' };
        }
        
        const change = this.pendingChanges[changeIndex];
        
        // Записываем в историю
        this.data.changeHistory.push({
            ...change,
            moderator: moderatorUsername,
            actionDate: new Date().toISOString(),
            status: 'rejected',
            reason: reason || 'Причина не указана'
        });
        
        // Удаляем из ожидающих
        this.pendingChanges.splice(changeIndex, 1);
        
        this.saveData();
        
        return { success: true };
    }
    
    promoteToModerator(username, ownerUsername) {
        const owner = this.data.users[ownerUsername];
        if (!owner || owner.role !== 'owner') {
            return { success: false, message: 'Требуются права владельца' };
        }
        
        const user = this.data.users[username];
        if (!user) {
            return { success: false, message: 'Пользователь не найден' };
        }
        
        if (user.role === 'moderator') {
            return { success: false, message: 'Пользователь уже модератор' };
        }
        
        user.role = 'moderator';
        this.saveData();
        
        return { success: true };
    }
    
    demoteModerator(username, ownerUsername) {
        const owner = this.data.users[ownerUsername];
        if (!owner || owner.role !== 'owner') {
            return { success: false, message: 'Требуются права владельца' };
        }
        
        const user = this.data.users[username];
        if (!user) {
            return { success: false, message: 'Пользователь не найден' };
        }
        
        if (user.role !== 'moderator') {
            return { success: false, message: 'Пользователь не является модератором' };
        }
        
        user.role = 'user';
        this.saveData();
        
        return { success: true };
    }
    
    getModerators() {
        return Object.entries(this.data.users)
            .filter(([_, user]) => user.role === 'moderator')
            .map(([username, user]) => ({ username, ...user }));
    }
    
    // UI методы
    initUI() {
        // Элементы интерфейса
        this.authPanel = document.getElementById('authPanel');
        this.appPanel = document.getElementById('appPanel');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.loginBtn = document.getElementById('loginBtn');
        this.registerBtn = document.getElementById('registerBtn');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.currentUserSpan = document.getElementById('currentUser');
        this.itemsList = document.getElementById('itemsList');
        this.newItemInput = document.getElementById('newItem');
        this.addItemBtn = document.getElementById('addItemBtn');
        this.pendingChangesDiv = document.getElementById('pendingChanges');
        this.pendingCountSpan = document.getElementById('pendingCount');
        this.moderationPanel = document.getElementById('moderationPanel');
        this.approveBtn = document.getElementById('approveBtn');
        this.rejectBtn = document.getElementById('rejectBtn');
        this.rejectReason = document.getElementById('rejectReason');
        this.adminPanel = document.getElementById('adminPanel');
        this.moderatorUsernameInput = document.getElementById('moderatorUsername');
        this.promoteBtn = document.getElementById('promoteBtn');
        this.demoteBtn = document.getElementById('demoteBtn');
        this.moderatorsList = document.getElementById('moderatorsList');
        
        // Обработчики событий
        this.loginBtn.addEventListener('click', () => this.handleLogin());
        this.registerBtn.addEventListener('click', () => this.handleRegister());
        this.logoutBtn.addEventListener('click', () => this.handleLogout());
        this.addItemBtn.addEventListener('click', () => this.handleAddItem());
        this.approveBtn.addEventListener('click', () => this.handleApprove());
        this.rejectBtn.addEventListener('click', () => this.handleReject());
        this.promoteBtn.addEventListener('click', () => this.handlePromote());
        this.demoteBtn.addEventListener('click', () => this.handleDemote());
        
        // Проверяем, есть ли сохраненный пользователь
        this.checkAuthState();
    }
    
    checkAuthState() {
        // В реальном приложении здесь можно проверить токен авторизации
        if (this.currentUser) {
            this.showApp();
        } else {
            this.showAuth();
        }
    }
    
    showAuth() {
        this.authPanel.classList.remove('hidden');
        this.appPanel.classList.add('hidden');
    }
    
    showApp() {
        this.authPanel.classList.add('hidden');
        this.appPanel.classList.remove('hidden');
        
        // Обновляем информацию о пользователе
        this.currentUserSpan.textContent = this.currentUser.username;
        if (this.currentUser.role === 'owner') {
            this.currentUserSpan.innerHTML += '<span class="user-badge owner">Владелец</span>';
        } else if (this.currentUser.role === 'moderator') {
            this.currentUserSpan.innerHTML += '<span class="user-badge moderator">Модератор</span>';
        }
        
        // Показываем/скрываем панель модерации
        if (this.currentUser.role === 'moderator' || this.currentUser.role === 'owner') {
            this.moderationPanel.classList.remove('hidden');
        } else {
            this.moderationPanel.classList.add('hidden');
        }
        
        // Показываем/скрываем панель администратора
        if (this.currentUser.role === 'owner') {
            this.adminPanel.classList.remove('hidden');
            this.updateModeratorsList();
        } else {
            this.adminPanel.classList.add('hidden');
        }
        
        // Обновляем списки
        this.updateItemsList();
        this.updatePendingChanges();
    }
    
    updateItemsList() {
        this.itemsList.innerHTML = '';
        const items = this.getApprovedItems();
        
        if (items.length === 0) {
            this.itemsList.innerHTML = '<p>Список пуст</p>';
            return;
        }
        
        items.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item';
            itemDiv.innerHTML = `
                <span>${item}</span>
                <div>
                    <button class="edit-btn secondary" data-id="${index}">✏️</button>
                    <button class="delete-btn danger" data-id="${index}">🗑️</button>
                </div>
            `;
            this.itemsList.appendChild(itemDiv);
        });
        
        // Добавляем обработчики для кнопок редактирования/удаления
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleEditItem(e.target.dataset.id));
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleDeleteItem(e.target.dataset.id));
        });
    }
    
    updatePendingChanges() {
        this.pendingChangesDiv.innerHTML = '';
        const changes = this.getPendingChanges();
        
        this.pendingCountSpan.textContent = `(${changes.length})`;
        
        if (changes.length === 0) {
            this.pendingChangesDiv.innerHTML = '<p>Нет изменений, ожидающих модерации</p>';
            return;
        }
        
        changes.forEach(change => {
            const changeDiv = document.createElement('div');
            changeDiv.className = 'change-item';
            changeDiv.dataset.id = change.id;
            
            let changeText = '';
            if (change.type === 'add') {
                changeText = `Добавить: "${change.item}"`;
            } else if (change.type === 'edit') {
                changeText = `Изменить: "${change.oldValue}" → "${change.newValue}"`;
            } else if (change.type === 'delete') {
                changeText = `Удалить: "${change.oldValue}"`;
            }
            
            changeDiv.innerHTML = `
                <p><strong>${changeText}</strong></p>
                <p>От: ${change.username} (${new Date(change.timestamp).toLocaleString()})</p>
                <button class="select-change-btn secondary" data-id="${change.id}">Выбрать</button>
            `;
            
            this.pendingChangesDiv.appendChild(changeDiv);
        });
        
        // Добавляем обработчики для кнопок выбора изменений
        document.querySelectorAll('.select-change-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectedChange = parseInt(e.target.dataset.id);
                document.querySelectorAll('.change-item').forEach(item => {
                    item.style.backgroundColor = item.dataset.id == this.selectedChange ? '#e6f7ff' : '#fff9e6';
                });
            });
        });
    }
    
    updateModeratorsList() {
        const moderators = this.getModerators();
        this.moderatorsList.innerHTML = '';
        
        if (moderators.length === 0) {
            this.moderatorsList.innerHTML = '<p>Нет назначенных модераторов</p>';
            return;
        }
        
        moderators.forEach(mod => {
            const modDiv = document.createElement('div');
            modDiv.className = 'item';
            modDiv.innerHTML = `
                <span>${mod.username}</span>
                <span>Зарегистрирован: ${new Date(mod.registrationDate).toLocaleDateString()}</span>
            `;
            this.moderatorsList.appendChild(modDiv);
        });
    }
    
    // Обработчики действий
    handleLogin() {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value.trim();
        
        if (!username || !password) {
            alert('Введите имя пользователя и пароль');
            return;
        }
        
        const result = this.loginUser(username, password);
        if (result.success) {
            this.showApp();
        } else {
            alert(result.message);
        }
    }
    
    handleRegister() {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value.trim();
        
        if (!username || !password) {
            alert('Введите имя пользователя и пароль');
            return;
        }
        
        const result = this.registerUser(username, password);
        alert(result.message);
        
        if (result.success) {
            this.loginUser(username, password);
            this.showApp();
        }
    }
    
    handleLogout() {
        this.logoutUser();
        this.showAuth();
        this.usernameInput.value = '';
        this.passwordInput.value = '';
    }
    
    handleAddItem() {
        const item = this.newItemInput.value.trim();
        if (!item) {
            alert('Введите текст элемента');
            return;
        }
        
        const result = this.addItem(item, this.currentUser.username);
        if (result.success) {
            this.newItemInput.value = '';
            this.updatePendingChanges();
            alert('Ваше изменение отправлено на модерацию');
        } else {
            alert(result.message);
        }
    }
    
    handleEditItem(itemId) {
        const newValue = prompt('Введите новое значение:', this.data.approvedItems[itemId]);
        if (newValue !== null) {
            const result = this.editItem(parseInt(itemId), newValue, this.currentUser.username);
            if (result.success) {
                this.updatePendingChanges();
                alert('Ваше изменение отправлено на модерацию');
            } else {
                alert(result.message);
            }
        }
    }
    
    handleDeleteItem(itemId) {
        if (confirm('Вы уверены, что хотите удалить этот элемент?')) {
            const result = this.deleteItem(parseInt(itemId), this.currentUser.username);
            if (result.success) {
                this.updatePendingChanges();
                alert('Ваше изменение отправлено на модерацию');
            } else {
                alert(result.message);
            }
        }
    }
    
    handleApprove() {
        if (!this.selectedChange) {
            alert('Выберите изменение для одобрения');
            return;
        }
        
        const result = this.approveChange(this.selectedChange, this.currentUser.username);
        if (result.success) {
            this.selectedChange = null;
            this.updateItemsList();
            this.updatePendingChanges();
            alert('Изменение одобрено');
        } else {
            alert(result.message);
        }
    }
    
    handleReject() {
        if (!this.selectedChange) {
            alert('Выберите изменение для отклонения');
            return;
        }
        
        const reason = this.rejectReason.value.trim();
        const result = this.rejectChange(this.selectedChange, this.currentUser.username, reason);
        if (result.success) {
            this.selectedChange = null;
            this.rejectReason.value = '';
            this.updatePendingChanges();
            alert('Изменение отклонено');
        } else {
            alert(result.message);
        }
    }
    
    handlePromote() {
        const username = this.moderatorUsernameInput.value.trim();
        if (!username) {
 
