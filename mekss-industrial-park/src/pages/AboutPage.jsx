import React from 'react';
import { Box, Typography, Paper, Container } from '@mui/material';

export const AboutPage = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          درباره سامانه مدیریت شهرک صنعتی مکث (Mekss)
        </Typography>
        <Paper sx={{ p: 3 }}>
          <Typography variant="body1" paragraph>
            سامانه مکث یک پلتفرم جامع و یکپارچه برای مدیریت هوشمند شهرک‌های صنعتی است. هدف ما در مکث، تسهیل فرآیندها، افزایش امنیت، و بهبود ارتباطات میان مدیران شهرک، صاحبان واحدهای صنعتی، و پرسنل نگهبانی است.
          </Typography>
          <Typography variant="h6" gutterBottom>
            امکانات کلیدی سامانه:
          </Typography>
          <Typography component="div" variant="body1">
            <ul>
              <li>مدیریت یکپارچه واحدهای صنعتی و اطلاعات مربوط به آن‌ها</li>
              <li>سیستم هوشمند صدور و اعتبارسنجی برگ خروج (Gate Pass)</li>
              <li>مدیریت آنلاین قبوض و پرداخت‌های الکترونیکی</li>
              <li>پنل ارتباطی قدرتمند شامل صندوق پیام، اطلاعیه‌ها و آگهی‌ها</li>
              <li>سیستم ثبت و پیگیری درخواست‌ها به صورت آنلاین</li>
              <li>داشبوردهای تحلیلی و گزارش‌گیری برای مدیران</li>
              <li>سیستم اعلام و مدیریت شرایط اضطراری مانند حریق</li>
              <li>قابلیت استفاده به عنوان Progressive Web App (PWA) برای دسترسی آسان بر روی موبایل</li>
            </ul>
          </Typography>
          <Typography variant="body1" paragraph sx={{ mt: 2 }}>
            ما معتقدیم با استفاده از تکنولوژی‌های نوین می‌توانیم به بهره‌وری و امنیت شهرک‌های صنعتی کمک شایانی کنیم. سامانه مکث با همین رویکرد طراحی و توسعه داده شده است.
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 4 }}>
            &copy; {new Date().getFullYear()} شرکت مهندسی مکث. تمامی حقوق محفوظ است.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default AboutPage;
