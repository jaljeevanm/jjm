document.addEventListener('DOMContentLoaded', async () => {

    // --- !!!!!!!!!!!!!!!!!!!!!!!!! ---
    // --- !!      IMPORTANT      !! ---
    // --- !!!!!!!!!!!!!!!!!!!!!!!!! ---
    // YOUR WEB APP URL (No changes needed here)
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxbN_LvrhTEagudrVvJxl0OVoN7wiQBanb5N0_QXKddNjHMJJ_Iwij4MFoAKRyxZ28/exec';
    
    
    // --- STATE & CONSTANTS ---
    let APP_DATA = { members: [], transactions: [] }; // This will hold all data
    const MONTHLY_FEE = 50;
    let currentCaptcha = '';
    let selectedMemberForPayment = null;
    let qrCodeInstance = null; // To hold the QR code object

    // --- SELECTORS ---
    const mainPages = document.querySelectorAll('.main-page');
    const navButtons = document.querySelectorAll('.nav-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const loader = document.getElementById('loader');

    // Add Member Page
    const addMemberForm = document.getElementById('add-member-form');
    const memberNameInput = document.getElementById('member-name');
    const memberAadharInput = document.getElementById('member-aadhar');
    const memberPhoneInput = document.getElementById('member-phone');
    const aadharError = document.getElementById('aadhar-error');
    const phoneError = document.getElementById('phone-error');
    const addMemberSuccess = document.getElementById('add-member-success');
    const memberListEdit = document.getElementById('member-list-edit');
    const searchEditMember = document.getElementById('search-edit-member');

    // Fees Collection Page
    const feesMemberList = document.getElementById('fees-member-list');
    const searchMemberFees = document.getElementById('search-member-fees');
    const paymentModal = document.getElementById('payment-modal');
    const closePaymentModal = document.getElementById('close-payment-modal');
    const paymentMemberName = document.getElementById('payment-member-name');
    const lastPaymentMonth = document.getElementById('last-payment-month');
    const monthsDue = document.getElementById('months-due');
    const monthsCheckboxContainer = document.getElementById('months-checkbox-container');
    const totalAmount = document.getElementById('total-amount');
    const processPaymentBtn = document.getElementById('process-payment-btn');
    const paymentSuccess = document.getElementById('payment-success');

    // Receipt Modal
    const receiptModal = document.getElementById('receipt-modal');
    const closeReceiptModal = document.getElementById('close-receipt-modal');
    const printReceiptBtn = document.getElementById('print-receipt-btn');
    const qrCodeContainer = document.getElementById('receipt-qrcode');

    // Transactions Page
    const transactionsTableBody = document.querySelector('#transactions-table tbody');
    const searchTransactions = document.getElementById('search-transactions');
    
    // View Receipts Page
    const receiptsTableBody = document.querySelector('#receipts-table tbody');
    const searchReceipts = document.getElementById('search-receipts');
    
    // Dashboard Stats
    const statTotalMembers = document.getElementById('stat-total-members');
    const statMonthlyCollection = document.getElementById('stat-monthly-collection');
    const statTotalCollection = document.getElementById('stat-total-collection');
    const statDuesPending = document.getElementById('stat-dues-pending');
    const pieChartContainer = document.getElementById('pie-chart-container');
    const pieLegendContainer = document.getElementById('pie-legend-container');
    
    // --- CORE FUNCTIONS ---

    function showMainPage(pageId) {
        mainPages.forEach(page => page.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
    }

    function showLoader(show) {
        loader.classList.toggle('active', show);
    }

    // --- BACKEND API FUNCTIONS (REAL) ---

    async function apiFetchData() {
        showLoader(true);
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAllData&v=${Date.now()}`); // Cache-bust
            if (!response.ok) throw new Error('Failed to fetch data');
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            APP_DATA = data; // Store fetched data in our local cache
            return data;
        } catch (error) {
            console.error(error);
            alert('Error loading data from Google Sheet: ' + error.message);
            return APP_DATA; // Return last known data on error
        } finally {
            showLoader(false);
        }
    }

    async function apiAddMember(memberData) {
        showLoader(true);
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=addMember`, {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify(memberData)
            });
            if (!response.ok) throw new Error('Failed to add member');
            const newMember = await response.json();
            if (newMember.error) throw new Error(newMember.error);
            
            APP_DATA.members.push(newMember); // Add to local cache
            return newMember;
        } catch (error) {
            console.error(error);
            alert('Error adding member: ' + error.message);
            return null;
        } finally {
            showLoader(false);
        }
    }

    async function apiProcessPayment(paymentData) {
        showLoader(true);
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=processPayment`, {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify(paymentData)
            });
            if (!response.ok) throw new Error('Failed to process payment');
            const newTransaction = await response.json();
            if (newTransaction.error) throw new Error(newTransaction.error);

            APP_DATA.transactions.push(newTransaction); // Add to local cache
            
            // Update member's last payment in local cache
            const member = APP_DATA.members.find(m => m.id === paymentData.memberId.toString());
            if (member) {
                member.lastPayment = paymentData.lastPaidMonthISO;
            }
            return newTransaction;
        } catch (error) {
            console.error(error);
            alert('Error processing payment: ' + error.message);
            return null;
        } finally {
            showLoader(false);
        }
    }


    // --- LOGOUT ---

    function handleLogout() {
        // Redirect back to the login page
        window.location.href = 'index.html';
    }

    // --- NAVIGATION ---

    function handleNavClick(e) {
        const button = e.target.closest('.nav-btn');
        if (!button) return;

        const pageId = button.dataset.page;
        navButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        showMainPage(pageId);

        // Load data for the specific page
        switch (pageId) {
            case 'main-dashboard':
                loadDashboardData();
                break;
            case 'main-add-member':
                loadEditableMemberList();
                break;
            case 'main-fees-collection':
                loadFeesCollectionList();
                break;
            case 'main-transactions':
                loadTransactionsList();
                break;
            case 'main-view-receipts':
                loadReceiptsList();
                break;
        }
    }
    
    // --- DASHBOARD PAGE ---
    
    function loadDashboardData() {
        const { members, transactions } = APP_DATA;
        
        statTotalMembers.textContent = members.length;
        
        const currentMonthYear = new Date().toISOString().slice(0, 7); // "YYYY-MM"
        const monthlyTotal = transactions
            .filter(t => t.date.startsWith(currentMonthYear))
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        statMonthlyCollection.textContent = `₹${monthlyTotal.toLocaleString('en-IN')}`;

        const totalCollection = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
        statTotalCollection.textContent = `₹${totalCollection.toLocaleString('en-IN')}`;
        
        let totalDues = 0;
        let paidMembers = 0;
        const currentDate = new Date();
        
        members.forEach(member => {
            const { dueMonths } = getDueMonths(member.lastPayment);
            if (dueMonths === 0) {
                paidMembers++;
            }
            totalDues += dueMonths * MONTHLY_FEE;
        });
        statDuesPending.textContent = `₹${totalDues.toLocaleString('en-IN')}`;
        
        // Update Pie Chart
        let paidPercent = 0;
        let unpaidPercent = 100;
        if (members.length > 0) {
             paidPercent = (paidMembers / members.length) * 100;
             unpaidPercent = 100 - paidPercent;
        }
        
        pieChartContainer.style.background = `conic-gradient(
            var(--success-color) 0% ${paidPercent}%, 
            var(--danger-color) ${paidPercent}% 100%
        )`;
        
        pieLegendContainer.innerHTML = `
            <li><span class="dot green"></span> Paid (${paidPercent.toFixed(0)}%)</li>
            <li><span class="dot red"></span> Unpaid (${unpaidPercent.toFixed(0)}%)</li>
        `;
    }

    // --- ADD MEMBER PAGE ---

    function validateAadhar(aadhar) {
        const regex = /^\d{12}$/;
        if (!regex.test(aadhar)) {
            aadharError.textContent = 'Aadhar Number must be exactly 12 digits.';
            aadharError.style.display = 'block';
            return false;
        }
        aadharError.style.display = 'none';
        return true;
    }

    function validatePhone(phone) {
        const regex = /^\d{10}$/;
        if (!regex.test(phone)) {
            phoneError.textContent = 'Phone Number must be exactly 10 digits.';
            phoneError.style.display = 'block';
            return false;
        }
        phoneError.style.display = 'none';
        return true;
    }

    async function handleAddMember(e) {
        e.preventDefault();
        addMemberSuccess.style.display = 'none';

        const name = memberNameInput.value.trim();
        const aadhar = memberAadharInput.value.trim();
        const phone = memberPhoneInput.value.trim();

        const isAadharValid = validateAadhar(aadhar);
        const isPhoneValid = validatePhone(phone);

        if (isAadharValid && isPhoneValid && name) {
            const memberData = { name, aadhar, phone };
            const newMember = await apiAddMember(memberData);
            
            if (newMember) {
                addMemberSuccess.textContent = `Successfully added member: ${newMember.name}`;
                addMemberSuccess.style.display = 'block';
                addMemberForm.reset();
                loadEditableMemberList(); // Refresh the list
                loadDashboardData(); // Refresh stats
            }
        }
    }

    function loadEditableMemberList(filter = '') {
        memberListEdit.innerHTML = '';
        const filteredMembers = APP_DATA.members.filter(m => 
            m.name.toLowerCase().includes(filter.toLowerCase()) ||
            m.aadhar.includes(filter)
        );

        if (filteredMembers.length === 0) {
            memberListEdit.innerHTML = '<p>No members found. Add a member to get started.</p>';
            return;
        }
        
        filteredMembers.forEach(member => {
            const item = document.createElement('div');
            item.className = 'member-list-item';
            item.innerHTML = `
                <div>
                    <strong>${member.name}</strong>
                    <p>${member.aadhar} | ${member.phone}</p>
                </div>
                <button class="btn btn-secondary btn-small" data-id="${member.id}">Edit</button>
            `;
            item.querySelector('button').addEventListener('click', () => {
                alert(`Edit functionality for ${member.name} is not implemented yet. Please edit directly in the Google Sheet.`);
            });
            memberListEdit.appendChild(item);
        });
    }

    // --- FEES COLLECTION PAGE ---
    
    function getDueMonths(lastPayment) { // lastPayment is "YYYY-MM"
        const months = [];
        let dueCount = 0;
        let lastPaidMonthName = 'N/A';
        
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth(); // 0-11
        
        let startDate;
        if (!lastPayment) {
            // Default: Dues start from Jan of this year
            startDate = new Date(currentYear, 0, 1); // Jan 1st
        } else {
            const [year, month] = lastPayment.split('-').map(Number);
            startDate = new Date(year, month, 1); // 1st of *next* month
            lastPaidMonthName = new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        }

        let iterDate = new Date(startDate);
        while (iterDate.getFullYear() < currentYear || (iterDate.getFullYear() === currentYear && iterDate.getMonth() <= currentMonth)) {
            const monthName = iterDate.toLocaleString('en-IN', { month: 'long' });
            const year = iterDate.getFullYear();
            const isoMonth = iterDate.toISOString().slice(0, 7); // "YYYY-MM"
            
            months.push({ name: `${monthName} ${year}`, value: isoMonth });
            dueCount++;
            
            iterDate.setMonth(iterDate.getMonth() + 1);
        }
        
        return { dueMonths: dueCount, monthsList: months, lastPaidMonthName: lastPaidMonthName };
    }

    function openPaymentModal(member) {
        selectedMemberForPayment = member;
        paymentMemberName.textContent = `Collect Fees for ${member.name}`;
        
        const { dueMonths, monthsList, lastPaidMonthName } = getDueMonths(member.lastPayment);
        
        lastPaymentMonth.textContent = lastPaidMonthName;
        monthsDue.textContent = dueMonths;
        
        monthsCheckboxContainer.innerHTML = '';
        if (monthsList.length === 0) {
            monthsCheckboxContainer.innerHTML = '<p>All payments are up to date.</p>';
            processPaymentBtn.disabled = true;
        } else {
            processPaymentBtn.disabled = false;
            monthsList.forEach(month => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" name="payment-month" value="${month.value}"> ${month.name}`;
                monthsCheckboxContainer.appendChild(label);
            });
            monthsCheckboxContainer.querySelectorAll('input').forEach(input => {
                input.addEventListener('change', calculateFee);
            });
        }
        
        totalAmount.textContent = '₹0';
        paymentSuccess.style.display = 'none';
        paymentModal.classList.add('active');
    }
    
    function calculateFee() {
        const selectedMonths = monthsCheckboxContainer.querySelectorAll('input:checked');
        const count = selectedMonths.length;
        const total = count * MONTHLY_FEE;
        totalAmount.textContent = `₹${total}`;
    }

    async function handleProcessPayment() {
        const selectedCheckboxes = Array.from(monthsCheckboxContainer.querySelectorAll('input:checked'));
        if (selectedCheckboxes.length === 0) {
            alert('Please select at least one month to pay.');
            return;
        }
        
        const amount = selectedCheckboxes.length * MONTHLY_FEE;
        const monthsPaid = selectedCheckboxes.map(cb => cb.parentElement.textContent.trim()).join(', ');
        const lastPaidMonthISO = selectedCheckboxes[selectedCheckboxes.length - 1].value;

        const paymentData = {
            memberId: selectedMemberForPayment.id,
            name: selectedMemberForPayment.name,
            aadhar: selectedMemberForPayment.aadhar,
            amount: amount,
            months: monthsPaid,
            lastPaidMonthISO: lastPaidMonthISO
        };
        
        const newTransaction = await apiProcessPayment(paymentData);
        
        if (newTransaction) {
            paymentSuccess.textContent = 'Payment successfully received!';
            paymentSuccess.style.display = 'block';
            processPaymentBtn.disabled = true;
            
            setTimeout(() => {
                paymentModal.classList.remove('active');
                generateReceipt(newTransaction);
                loadFeesCollectionList(); // Refresh list
                loadDashboardData(); // Refresh dashboard stats
            }, 2000);
        }
    }

    function loadFeesCollectionList(filter = '') {
        feesMemberList.innerHTML = '';
        
        const filteredMembers = APP_DATA.members.filter(m => 
            m.name.toLowerCase().includes(filter.toLowerCase()) ||
            m.aadhar.includes(filter)
        );

        if (filteredMembers.length === 0) {
            feesMemberList.innerHTML = '<p>No members found. Add a member first.</p>';
            return;
        }
        
        filteredMembers.forEach(member => {
            const { dueMonths } = getDueMonths(member.lastPayment);
            const item = document.createElement('div');
            item.className = 'member-fees-item';
            item.innerHTML = `
                <div>
                    <strong>${member.name}</strong>
                    <p>${member.aadhar}</p>
                </div>
                <div style="text-align: right;">
                    <strong>${dueMonths} Months Due</strong>
                    <p>Total: ₹${dueMonths * MONTHLY_FEE}</p>
                </div>
            `;
            item.addEventListener('click', () => openPaymentModal(member));
            feesMemberList.appendChild(item);
        });
    }

    // --- RECEIPT GENERATION & PRINTING ---

    function generateReceipt(txnData) {
        document.getElementById('receipt-txn-id').textContent = txnData.id;
        document.getElementById('receipt-name').textContent = txnData.name;
        document.getElementById('receipt-aadhar').textContent = txnData.aadhar;
        document.getElementById('receipt-months').textContent = txnData.months;
        document.getElementById('receipt-amount').textContent = `₹${parseFloat(txnData.amount).toLocaleString('en-IN')}`;
        document.getElementById('receipt-date').textContent = new Date(txnData.date).toLocaleDateString('en-IN');
        document.getElementById('receipt-time').textContent = txnData.time;
        
        qrCodeContainer.innerHTML = '';
        const qrText = `TxnID: ${txnData.id}, Name: ${txnData.name}, Amount: ${txnData.amount}, Date: ${txnData.date}`;
        
        if (qrCodeInstance) {
            qrCodeInstance.clear();
            qrCodeInstance.makeCode(qrText);
        } else {
            qrCodeInstance = new QRCode(qrCodeContainer, {
                text: qrText,
                width: 120,
                height: 120,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
        
        receiptModal.classList.add('active');
    }

    function handlePrintReceipt() {
        window.print();
    }
    
    // --- TRANSACTIONS PAGE ---
    
    function loadTransactionsList(filter = '') {
        transactionsTableBody.innerHTML = '';
        
        const filteredTxns = APP_DATA.transactions.filter(t =>
            t.name.toLowerCase().includes(filter.toLowerCase()) ||
            t.aadhar.includes(filter) ||
            t.id.toLowerCase().includes(filter.toLowerCase())
        ).reverse(); // Show newest first
        
        if (filteredTxns.length === 0) {
            transactionsTableBody.innerHTML = '<tr><td colspan="6">No transactions found.</td></tr>';
            return;
        }
        
        filteredTxns.forEach(txn => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${txn.id}</td>
                <td>${txn.name}</td>
                <td>${txn.aadhar}</td>
                <td>₹${parseFloat(txn.amount).toLocaleString('en-IN')}</td>
                <td>${txn.months}</td>
                <td>${new Date(txn.date).toLocaleDateString('en-IN')} ${txn.time}</td>
            `;
            transactionsTableBody.appendChild(row);
        });
    }
    
    // --- VIEW RECEIPTS PAGE ---

    function loadReceiptsList(filter = '') {
        receiptsTableBody.innerHTML = '';
        
        const filteredTxns = APP_DATA.transactions.filter(t =>
            t.name.toLowerCase().includes(filter.toLowerCase()) ||
            t.aadhar.includes(filter) ||
            t.id.toLowerCase().includes(filter.toLowerCase())
        ).reverse(); // Show newest first
        
        if (filteredTxns.length === 0) {
            receiptsTableBody.innerHTML = '<tr><td colspan="5">No receipts found.</td></tr>';
            return;
        }
        
        filteredTxns.forEach(txn => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${txn.id}</td>
                <td>${txn.name}</td>
                <td>₹${parseFloat(txn.amount).toLocaleString('en-IN')}</td>
                <td>${new Date(txn.date).toLocaleDateString('en-IN')}</td>
                <td><button class="btn btn-small btn-secondary print-receipt-btn" data-txnid="${txn.id}">Print</button></td>
            `;
            receiptsTableBody.appendChild(row);
        });
        
        receiptsTableBody.querySelectorAll('.print-receipt-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const txnId = e.target.dataset.txnid;
                const txnData = APP_DATA.transactions.find(t => t.id === txnId);
                if (txnData) {
                    generateReceipt(txnData);
                }
            });
        });
    }


    // --- EVENT LISTENERS ---
    logoutBtn.addEventListener('click', handleLogout);
    
    document.querySelector('.sidebar').addEventListener('click', handleNavClick);
    
    addMemberForm.addEventListener('submit', handleAddMember);
    memberAadharInput.addEventListener('input', () => validateAadhar(memberAadharInput.value));
    memberPhoneInput.addEventListener('input', () => validatePhone(memberPhoneInput.value));
    
    closePaymentModal.addEventListener('click', () => paymentModal.classList.remove('active'));
    processPaymentBtn.addEventListener('click', handleProcessPayment);
    searchMemberFees.addEventListener('input', (e) => loadFeesCollectionList(e.target.value));
    searchEditMember.addEventListener('input', (e) => loadEditableMemberList(e.target.value));

    closeReceiptModal.addEventListener('click', () => receiptModal.classList.remove('active'));
    printReceiptBtn.addEventListener('click', handlePrintReceipt);
    
    searchTransactions.addEventListener('input', (e) => loadTransactionsList(e.target.value));
    searchReceipts.addEventListener('input', (e) => loadReceiptsList(e.target.value));
    
    
    // --- INITIALIZATION ---
    // Load data as soon as the dashboard page opens
    await apiFetchData();
    loadDashboardData(); 
    
    // Set default page
    navButtons[0].classList.add('active');
    mainPages[0].classList.add('active');

});
