const DateManager = window.DateManager;

if (!DateManager) {
    throw new Error('DateManager 未載入，請確認已正確引入 src/scripts/date-manager.js');
}

if (typeof DateManager.initializeDateController !== 'function') {
    throw new Error('DateManager.initializeDateController 未定義，請檢查 date-manager.js');
}

// 解析展览日期范围文本
function parseExhibitionDateRange(dateText) {
    if (!dateText) return null;

    // 匹配格式：YYYY-MM-DD ～ YYYY-MM-DD
    const rangeMatch = dateText.match(/(\d{4}-\d{2}-\d{2})\s*～\s*(\d{4}-\d{2}-\d{2})/);
    if (rangeMatch) {
        return {
            startDate: DateManager.parseDate(rangeMatch[1]),
            endDate: DateManager.parseDate(rangeMatch[2])
        };
    }

    // 匹配单个日期
    const singleMatch = dateText.match(/(\d{4}-\d{2}-\d{2})/);
    if (singleMatch) {
        return {
            startDate: DateManager.parseDate(singleMatch[1]),
            endDate: null
        };
    }

    return null;
}

// 检查展览是否已过期
function isExhibitionExpired(dateText, visitDate) {
    const dateRange = parseExhibitionDateRange(dateText);
    if (!dateRange || !dateRange.endDate) {
        return false; // 没有结束日期的展览不算过期（常设展、长期展等）
    }
    return visitDate > dateRange.endDate;
}

// 检查展览是否未开始
function isExhibitionNotStarted(dateText, visitDate) {
    const dateRange = parseExhibitionDateRange(dateText);
    if (!dateRange || !dateRange.startDate) {
        return false;
    }
    return visitDate < dateRange.startDate;
}

// 生成倒计时文本
function generateCountdownText(dateText, visitDate) {
    const dateRange = parseExhibitionDateRange(dateText);
    if (!dateRange) return '';

    if (dateRange.startDate && visitDate < dateRange.startDate) {
        // 未开始
        const daysUntilStart = DateManager.daysDifference(visitDate, dateRange.startDate);
        return `（還有 ${daysUntilStart} 天開始）`;
    } else if (dateRange.endDate && visitDate <= dateRange.endDate) {
        // 进行中
        const daysRemaining = DateManager.daysDifference(visitDate, dateRange.endDate);
        return `（還有 ${daysRemaining} 天）`;
    }

    return '';
}

// 更新所有展览卡片的倒计时和过期状态
function updateExhibitionCards(visitDate) {
    document.querySelectorAll('.exhibition-card').forEach(card => {
        const dateElement = card.querySelector('.date');
        if (!dateElement) return;

        const dateText = dateElement.textContent.trim();

        // 移除旧的倒计时
        const oldCountdown = dateElement.querySelector('.countdown');
        if (oldCountdown) {
            oldCountdown.remove();
        }

        // 添加新的倒计时
        const countdownText = generateCountdownText(dateText, visitDate);
        if (countdownText) {
            const countdownSpan = document.createElement('span');
            countdownSpan.className = 'countdown';
            countdownSpan.textContent = countdownText;
            dateElement.appendChild(countdownSpan);
        }

        // 更新过期状态
        if (isExhibitionExpired(dateText, visitDate)) {
            card.classList.add('expired');
        } else {
            card.classList.remove('expired');
        }
    });
}

// 统计展览区的过期展览数量
function countExpiredExhibitions(sectionElement, visitDate) {
    const cards = sectionElement.querySelectorAll('.exhibition-card');
    let expiredCount = 0;

    for (const card of cards) {
        const dateElement = card.querySelector('.date');
        if (!dateElement) continue;

        const dateText = dateElement.textContent.trim();
        if (isExhibitionExpired(dateText, visitDate)) {
            expiredCount++;
        }
    }
    return expiredCount;
}

// 更新或创建"显示/隐藏过期展览"按钮
function updateToggleExpiredButton(visitDate) {
    document.querySelectorAll('.exhibition-section').forEach(section => {
        const expiredCount = countExpiredExhibitions(section, visitDate);

        // 移除旧按钮（如果存在）
        const oldButton = section.querySelector('.toggle-expired-btn');
        if (oldButton) {
            oldButton.remove();
        }

        // 如果有过期展览，创建按钮
        if (expiredCount > 0) {
            const button = document.createElement('button');
            button.className = 'toggle-expired-btn';
            button.innerHTML = `
                <i class="fas fa-eye"></i>
                <span>顯示 <span class="expired-count">${expiredCount}</span> 個已過期展覽</span>
            `;

            // 将按钮插入到标题后面
            const header = section.querySelector('h2');
            header.after(button);

            // 绑定点击事件
            button.addEventListener('click', () => {
                section.classList.toggle('show-expired');

                // 更新按钮文本
                if (section.classList.contains('show-expired')) {
                    button.innerHTML = `
                        <i class="fas fa-eye-slash"></i>
                        <span>隱藏 <span class="expired-count">${expiredCount}</span> 個已過期展覽</span>
                    `;
                } else {
                    button.innerHTML = `
                        <i class="fas fa-eye"></i>
                        <span>顯示 <span class="expired-count">${expiredCount}</span> 個已過期展覽</span>
                    `;
                }
            });
        }
    });
}

// 标签页切换功能
document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // 移除所有活动状态
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // 添加活动状态到当前标签
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });

    // 初始化日期选择器
    DateManager.initializeDateController({
        inputId: 'homepage-visit-date',
        todayBtnId: 'today-btn',
        resetUrlOnToday: true,
        onChange: ({ date }) => {
            if (!date) {
                return;
            }
            updateExhibitionCards(date);
            updateToggleExpiredButton(date);
        }
    });

    // 展览详情模态框
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    const closeBtn = document.querySelector('.close');
    const exhibitionCards = document.querySelectorAll('.exhibition-card');

    exhibitionCards.forEach(card => {
        const detailsBtn = card.querySelector('.details-btn');

        const openDetails = async () => {
            const linkTarget = card.getAttribute('data-link');
            if (linkTarget) {
                // 跳转到详情页时携带日期参数
                const dateInput = document.getElementById('homepage-visit-date');
                if (dateInput && dateInput.value) {
                    const url = new URL(linkTarget, window.location.href);
                    url.searchParams.set('date', dateInput.value);
                    window.location.href = url.toString();
                } else {
                    window.location.href = linkTarget;
                }
                return;
            }

            const filePath = card.getAttribute('data-file');
            await loadExhibitionDetails(filePath);
        };

        if (detailsBtn) {
            detailsBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await openDetails();
            });
        }

        // 点击卡片也可以打开详情
        card.addEventListener('click', async () => {
            await openDetails();
        });
    });

    // 加载展览详情
    async function loadExhibitionDetails(filePath) {
        if (!filePath) {
            return;
        }

        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error('无法加载展览详情');
            }
            const markdownText = await response.text();
            const htmlContent = marked.parse(markdownText);
            modalBody.innerHTML = htmlContent;
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden'; // 防止背景滚动
        } catch (error) {
            console.error('加载展览详情失败:', error);
            modalBody.innerHTML = '<h2>抱歉，无法加载展览详情</h2><p>请稍后再试或访问官方网站查看详情。</p>';
            modal.style.display = 'block';
        }
    }

    // 关闭模态框
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });

    // ESC键关闭模态框
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });

    // 平滑滚动
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // 为模态框中的外部链接添加target="_blank"
    const observer = new MutationObserver(() => {
        const modalLinks = modalBody.querySelectorAll('a[href^="http"]');
        modalLinks.forEach(link => {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });
    });

    observer.observe(modalBody, {
        childList: true,
        subtree: true
    });
});
