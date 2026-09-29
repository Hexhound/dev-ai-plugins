#pragma once
// Records a Qt app, driven in-process under QT_QPA_PLATFORM=offscreen, as the capture
// contract: <out>/<segment>/NNNN.png + capture.json (markers, tracks, rects).
#include <QApplication>
#include <QDir>
#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QPainter>
#include <QPointer>
#include <QTest>
#include <cmath>
#include <functional>
#include <optional>

namespace promo {

inline double ease(double t)
{
    return t < 0.5 ? 4 * t * t * t : 1 - std::pow(-2 * t + 2, 3) / 2;
}

// The first visible widget of type T with this object name, in any window.
template <typename T = QWidget>
T *find(const QString &name)
{
    for (QWidget *widget : QApplication::allWidgets())
        if (widget->objectName() == name && widget->isVisible())
            if (auto *typed = qobject_cast<T *>(widget))
                return typed;
    return nullptr;
}

inline void waitFor(const std::function<bool()> &ready, int ms = 60000)
{
    if (!QTest::qWaitFor(ready, ms))
        qFatal("promo: timed out waiting");
}

class Recorder {
public:
    Recorder(QWidget &window, QString out, int fps = 30) : m_window(window), m_out(std::move(out)), m_fps(fps) {}
    ~Recorder() { finish(); }

    void begin(const QString &segment)
    {
        finish();
        m_segment = segment;
        m_count = 0;
        m_markers = {};
        m_tracks = {};
        m_rects = {};
        m_pending.clear();
        QDir(dir()).removeRecursively();
        QDir().mkpath(dir());
        qInfo().noquote() << "promo: segment" << segment;
    }

    // Names the next frame; the composition maps storyboard events through these.
    void marker(const QString &name) { m_markers.insert(name, m_count); }

    // Tracks and values are sticky: they repeat each frame until set again.
    // A moving action point, in window coordinates (or none).
    void track(const QString &name, std::optional<QPointF> windowPoint)
    {
        m_pending.insert(name, windowPoint ? QJsonValue(QJsonArray{nx(windowPoint->x()), ny(windowPoint->y())}) : QJsonValue());
    }
    // A value that changes over time (a slider, a counter) for the next frame.
    void value(const QString &name, double v) { m_pending.insert(name, v); }

    // A region the camera can push to or a callout can point at, from the next frame on.
    void rect(const QString &name, const QRectF &windowRect)
    {
        m_rects.insert(name, QJsonObject{{"from", m_count},
                                          {"rect", QJsonArray{nx(windowRect.x()), ny(windowRect.y()), nx(windowRect.width()), ny(windowRect.height())}}});
    }
    void rect(const QString &name, const QWidget *widget)
    {
        // Through global coordinates, so floating panels (their own windows) work too.
        rect(name, QRectF(widget->mapToGlobal(QPoint(0, 0)) - m_window.mapToGlobal(QPoint(0, 0)), widget->size()));
    }

    QImage compose()
    {
        QTest::qWait(12);
        const QPixmap base = m_window.grab();
        QImage image(base.size(), QImage::Format_ARGB32_Premultiplied);
        image.setDevicePixelRatio(base.devicePixelRatio());
        image.fill(Qt::black);
        QPainter painter(&image);
        painter.drawPixmap(0, 0, base);
        // Floating panels and dialogs are their own windows: paint them where they sit.
        for (QWidget *top : QApplication::topLevelWidgets()) {
            if (top == &m_window || !top->isVisible() || !top->isWindow() || top->size().isEmpty())
                continue;
            const QPoint at = top->geometry().topLeft() - m_window.geometry().topLeft();
            painter.setPen(Qt::NoPen);
            for (int ring = 12; ring > 0; --ring) {
                painter.setBrush(QColor(0, 0, 0, 6));
                painter.drawRoundedRect(QRectF(at, top->size()).adjusted(-ring, -ring + 6, ring, ring + 6), 10 + ring, 10 + ring);
            }
            painter.drawPixmap(at, top->grab());
        }
        return image;
    }

    void frame() { save(compose()); }
    void hold(int frames)
    {
        if (frames <= 0)
            return;
        const QString first = path(m_count);
        save(compose());
        for (int i = 1; i < frames; ++i) {
            QFile::copy(first, path(m_count));
            flushPending();
        }
    }
    // `step` gets eased progress 0…1, once per frame.
    void animate(int frames, const std::function<void(double)> &step, bool eased = true)
    {
        for (int i = 0; i < frames; ++i) {
            const double t = double(i + 1) / frames;
            step(eased ? ease(t) : t);
            frame();
        }
    }

    void finish()
    {
        if (m_segment.isEmpty())
            return;
        const QImage probe(path(0));
        QJsonObject doc{{"fps", m_fps},
                        {"size", QJsonArray{probe.width(), probe.height()}},
                        {"frames", m_count},
                        {"markers", m_markers},
                        {"tracks", m_tracks},
                        {"rects", m_rects}};
        QFile file(dir() + "/capture.json");
        if (file.open(QIODevice::WriteOnly))
            file.write(QJsonDocument(doc).toJson(QJsonDocument::Indented));
        m_segment.clear();
    }

    QString dir() const { return m_out + "/" + m_segment; }

private:
    QString path(int index) const { return QStringLiteral("%1/%2.png").arg(dir()).arg(index, 4, 10, QLatin1Char('0')); }
    double nx(double x) const { return std::round(x / m_window.width() * 1e4) / 1e4; }
    double ny(double y) const { return std::round(y / m_window.height() * 1e4) / 1e4; }

    void save(const QImage &image)
    {
        image.save(path(m_count));
        flushPending();
    }
    // Tracks are dense arrays, one entry per frame; frames without data are null.
    void flushPending()
    {
        for (auto it = m_pending.begin(); it != m_pending.end(); ++it) {
            QJsonArray series = m_tracks.value(it.key()).toArray();
            while (series.size() < m_count)
                series.append(QJsonValue());
            series.append(it.value());
            m_tracks.insert(it.key(), series);
        }
        ++m_count;
    }

    QWidget &m_window;
    const QString m_out;
    const int m_fps;
    QString m_segment;
    int m_count = 0;
    QJsonObject m_markers, m_tracks, m_rects;
    QMap<QString, QJsonValue> m_pending;
};

}
