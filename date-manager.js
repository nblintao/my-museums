/**
 * 日期管理工具，供首頁與展覽詳情頁共用。
 * 提供日期解析、URL 同步以及輸入控件初始化等功能。
 */
(function initDateManager(global) {
    const hasWindow = typeof window !== 'undefined';

    function parseDate(dateStr) {
        if (dateStr === null || dateStr === undefined) {
            return null;
        }
        const raw = String(dateStr).trim();
        if (!raw) {
            return null;
        }
        const parts = raw.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
                const date = new Date(year, month, day);
                if (!Number.isNaN(date.getTime())) {
                    return date;
                }
            }
        }
        const fallback = new Date(raw);
        return Number.isNaN(fallback.getTime()) ? null : fallback;
    }

    function daysDifference(dateA, dateB) {
        if (!(dateA instanceof Date) || Number.isNaN(dateA.getTime())) {
            return NaN;
        }
        if (!(dateB instanceof Date) || Number.isNaN(dateB.getTime())) {
            return NaN;
        }
        const msPerDay = 24 * 60 * 60 * 1000;
        return Math.round((dateB.getTime() - dateA.getTime()) / msPerDay);
    }

    function getDateFromURL(paramName = 'date') {
        if (!hasWindow) {
            return null;
        }
        const params = new URLSearchParams(window.location.search);
        const value = params.get(paramName);
        return value && value.trim() ? value : null;
    }

    function setDateInURL(dateStr, paramName = 'date') {
        if (!hasWindow || typeof URL === 'undefined' || typeof window.history === 'undefined') {
            return;
        }
        const url = new URL(window.location.href);
        const normalized = dateStr !== null && dateStr !== undefined ? String(dateStr).trim() : '';
        if (normalized) {
            url.searchParams.set(paramName, normalized);
        } else {
            url.searchParams.delete(paramName);
        }
        window.history.replaceState({}, '', url);
    }

    function getTodayString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function createNoopController() {
        return {
            cleanup() {},
            getDate() {
                return '';
            },
            setDate() {}
        };
    }

    function initializeDateController(options = {}) {
        const {
            inputId,
            inputElement,
            todayBtnId,
            todayButton,
            urlParam = 'date',
            syncUrl = true,
            resetUrlOnToday = true,
            initialDate,
            defaultDateProvider = getTodayString,
            todayProvider = getTodayString,
            onChange,
            onToday
        } = options;

        const input = inputElement || (inputId ? document.getElementById(inputId) : null);
        const todayBtn = todayButton || (todayBtnId ? document.getElementById(todayBtnId) : null);

        if (!input) {
            console.error('[DateManager] 找不到日期輸入框', inputId || inputElement);
            return createNoopController();
        }

        const readInputValue = () => (input.value || '').trim();

        const urlValue = syncUrl ? getDateFromURL(urlParam) : null;
        const hasUrlValue = typeof urlValue === 'string' && urlValue.trim().length > 0;

        let resolvedInitial = '';
        if (hasUrlValue) {
            resolvedInitial = urlValue;
        } else if (typeof initialDate === 'function') {
            resolvedInitial = initialDate() || '';
        } else if (typeof initialDate === 'string' && initialDate.trim()) {
            resolvedInitial = initialDate.trim();
        } else {
            const existingValue = readInputValue();
            if (existingValue) {
                resolvedInitial = existingValue;
            } else if (typeof defaultDateProvider === 'function') {
                resolvedInitial = defaultDateProvider() || '';
            } else if (typeof defaultDateProvider === 'string') {
                resolvedInitial = defaultDateProvider;
            }
        }

        if (resolvedInitial) {
            input.value = resolvedInitial;
        }

        const emitChange = (dateString, source, extra = {}) => {
            if (typeof onChange !== 'function') {
                return;
            }
            const normalized = (dateString || '').trim();
            const payload = {
                dateString: normalized,
                date: normalized ? parseDate(normalized) : null,
                source,
                fromUrl: Boolean(extra.fromUrl),
                urlValue: extra.urlValue,
                syncedUrl: Boolean(extra.syncedUrl)
            };
            onChange(payload);
        };

        if (resolvedInitial || typeof onChange === 'function') {
            emitChange(resolvedInitial, 'init', {
                fromUrl: hasUrlValue,
                urlValue: hasUrlValue ? resolvedInitial : readInputValue(),
                syncedUrl: false
            });
        }

        const handleChange = () => {
            const value = readInputValue();
            if (syncUrl) {
                const hasValue = Boolean(value);
                setDateInURL(hasValue ? value : null, urlParam);
            }
            emitChange(value, 'change', {
                fromUrl: false,
                urlValue: syncUrl ? (value || null) : undefined,
                syncedUrl: syncUrl
            });
        };

        input.addEventListener('change', handleChange);

        const handleTodayClick = () => {
            const todayStr = todayProvider() || getTodayString();
            input.value = todayStr;

            let syncedUrlValue = todayStr;
            if (syncUrl) {
                if (resetUrlOnToday) {
                    setDateInURL(null, urlParam);
                    syncedUrlValue = null;
                } else {
                    setDateInURL(todayStr, urlParam);
                }
            }

            emitChange(todayStr, 'today', {
                fromUrl: false,
                urlValue: syncUrl ? syncedUrlValue : undefined,
                syncedUrl: syncUrl
            });

            if (typeof onToday === 'function') {
                onToday({
                    dateString: todayStr,
                    date: parseDate(todayStr)
                });
            }
        };

        if (todayBtn) {
            todayBtn.addEventListener('click', handleTodayClick);
        }

        return {
            cleanup() {
                input.removeEventListener('change', handleChange);
                if (todayBtn) {
                    todayBtn.removeEventListener('click', handleTodayClick);
                }
            },
            getDate() {
                return readInputValue();
            },
            setDate(dateString, { sync = syncUrl } = {}) {
                const normalized = (dateString || '').trim();
                input.value = normalized;
                if (sync) {
                    setDateInURL(normalized || null, urlParam);
                }
                emitChange(normalized, 'external-set', {
                    fromUrl: false,
                    urlValue: sync ? (normalized || null) : undefined,
                    syncedUrl: sync
                });
            }
        };
    }

    const DateManager = {
        parseDate,
        daysDifference,
        getDateFromURL,
        setDateInURL,
        getTodayString,
        initializeDateController
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = DateManager;
    }

    if (global && !global.DateManager) {
        global.DateManager = DateManager;
    }
})(typeof window !== 'undefined' ? window : globalThis);
