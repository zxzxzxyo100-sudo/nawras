# ============================================================
# سكريبت نشر البيئة التجريبية — nawras CRM
# الاستخدام: تشغيله من مجلد المشروع
# ============================================================

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor DarkMagenta
Write-Host "   نشر البيئة التجريبية — nawras CRM   " -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor DarkMagenta
Write-Host ""

# ── 1. التأكد من الفرع ──────────────────────────────────────
$currentBranch = git rev-parse --abbrev-ref HEAD 2>&1
if ($currentBranch -ne "staging") {
    Write-Host "⚠️  أنت حالياً على فرع: $currentBranch" -ForegroundColor Yellow
    $switch = Read-Host "   هل تريد الانتقال لفرع staging؟ (y/n)"
    if ($switch -eq "y" -or $switch -eq "Y") {
        git checkout staging
        Write-Host "✅ تم الانتقال لفرع staging" -ForegroundColor Green
    } else {
        Write-Host "❌ تم الإلغاء — يجب أن تكون على فرع staging" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "🔨 جارٍ بناء النسخة التجريبية..." -ForegroundColor Cyan
Set-Location "$ProjectRoot\react-crm"
npm run build:staging
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ فشل البناء — تم إلغاء النشر" -ForegroundColor Red
    Set-Location $ProjectRoot
    exit 1
}
Set-Location $ProjectRoot
Write-Host "✅ تم البناء بنجاح" -ForegroundColor Green

# ── 2. عرض التعديلات ────────────────────────────────────────
Write-Host ""
Write-Host "📋 التعديلات التي ستُرفع:" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor DarkGray
git status --short
Write-Host "----------------------------------------" -ForegroundColor DarkGray

$changed = git status --short
if (-not $changed) {
    Write-Host "ℹ️  لا توجد تعديلات جديدة للرفع" -ForegroundColor DarkGray
    exit 0
}

# ── 3. طلب التأكيد ──────────────────────────────────────────
Write-Host ""
$confirm = Read-Host "🚀 هل تريد رفع هذه التعديلات لـ staging؟ (y/n)"

if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "❌ تم الإلغاء — لم يُرفع شيء" -ForegroundColor Red
    exit 0
}

# ── 4. طلب رسالة الـ commit ─────────────────────────────────
Write-Host ""
$message = Read-Host "📝 أدخل وصف التعديل (أو Enter للاسم الافتراضي)"
if (-not $message) {
    $date = Get-Date -Format "yyyy-MM-dd HH:mm"
    $message = "staging: update $date"
}

# ── 5. commit و push ────────────────────────────────────────
Write-Host ""
Write-Host "📤 جارٍ الرفع..." -ForegroundColor Cyan
git add -A
git commit -m $message
git push origin staging

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor DarkGreen
    Write-Host " ✅ تم النشر بنجاح على البيئة التجريبية" -ForegroundColor Green
    Write-Host "    🌐 https://staging.nawras-ly.com    " -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor DarkGreen
} else {
    Write-Host "❌ فشل الرفع — تحقق من الاتصال" -ForegroundColor Red
}
Write-Host ""
