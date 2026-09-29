// OmaPhoto promo capture, in story order: remove → main → themes.
#include "Document/ProjectWorkspace.h"
#include "Rendering/EditorCanvas.h"
#include "UI/OmarchyTheme.h"
#include "UI/ProjectWorkspaceView.h"
#include "UI/SliderSnap.h"
#include "promo_recorder.h"
#include <QLineEdit>
#include <QPushButton>
#include <QSlider>
#include <memory>

using promo::find;
using promo::waitFor;

int main(int argc, char **argv)
{
    QApplication application(argc, argv);
    QApplication::setApplicationName(QStringLiteral("OmaPhoto"));
    const QString assets = qEnvironmentVariable("PROMO_ASSETS");
    auto theme = std::make_unique<OmarchyTheme>(assets + "/themes/tokyo-night");
    SliderSnap::install();
    ProjectWorkspace workspace;
    ProjectWorkspaceView window(workspace);
    window.resize(1600, 940);
    window.show();
    window.activateWindow();
    QTest::qWaitForWindowActive(&window);
    promo::Recorder rec(window, qEnvironmentVariable("PROMO_OUT"));

    // Helpers bound to whichever tab is in front.
    EditorSession *session = &workspace.current().session;
    const auto canvas = [&] { return window.findChild<CanvasView *>(); };
    const auto docSize = [&] { return session->document().value().size(); };
    const auto viewOf = [&](QPointF document) { return session->viewport.viewPoint(document, docSize()); };
    const auto windowOf = [&](QPointF view) { return QPointF(canvas()->mapTo(&window, QPoint(0, 0))) + view; };
    const auto layerRect = [&](QUuid id) {
        for (const ImageLayer &layer : session->document().value().layers)
            if (layer.id == id)
                return QRectF(windowOf(viewOf(layer.origin())), windowOf(viewOf(layer.origin() + QPointF(layer.size().width(), layer.size().height()))));
        qFatal("no such layer");
    };
    const auto import = [&](const QString &file, QPointF centre) {
        bool done = false;
        session->importImages({QUrl::fromLocalFile(assets + "/" + file)}, centre, [&] { done = true; });
        waitFor([&] { return done; });
        QTest::qWait(100);
        return session->activeLayerID().value();
    };
    const auto removeBackground = [&] {
        session->beginFilter(FilterKind::removeBackground);
        waitFor([&] { return find<QPushButton>(QStringLiteral("filterOK")) && !find<QWidget>(QStringLiteral("filterSpinner")); });
        QTest::qWait(300);
        find<QPushButton>(QStringLiteral("filterOK"))->click();
        waitFor([&] { return session->activeLayer()->mask.has_value() && !find<QWidget>(QStringLiteral("filterOK")); });
        QTest::qWait(300);
    };
    const auto settle = [&] {
        session->setShowsTransformControls(false);
        session->fit();
        QTest::qWait(400);
    };

    // ── remove: the raw wolf photo in its own tab, then the committed cut-out.
    session->createDocument(1250, 833);
    session->setProjectPath(QStringLiteral("/tmp/Wolf.comp"));
    const QUuid photo = import(QStringLiteral("Wolf.png"), QPointF(625, 416.5));
    settle();
    rec.begin(QStringLiteral("remove"));
    rec.rect(QStringLiteral("canvas"), canvas());
    rec.rect(QStringLiteral("photo"), layerRect(photo));
    rec.marker(QStringLiteral("before"));
    rec.hold(90);
    removeBackground();
    rec.marker(QStringLiteral("after"));
    rec.hold(90);

    // ── main: the poster in a second tab; its wolf is cut out off camera.
    ProjectTab &poster = workspace.addTab(false);
    workspace.select(poster.id);
    QTest::qWait(200);
    session = &poster.session;
    session->createDocument(1536, 1024);
    session->setProjectPath(QStringLiteral("/tmp/Wild.comp"));
    const QUuid lake = import(QStringLiteral("Golden Lake.png"), QPointF(768, 512));
    const auto text = [&](const QString &content, const QString &font, double size, QPointF origin, double tracking) {
        TextDraft draft;
        draft.documentID = session->document().value().id;
        draft.origin = origin;
        draft.style.content = content;
        draft.style.fontName = font;
        draft.style.fontSize = size;
        draft.style.red = draft.style.green = draft.style.blue = 1;
        draft.style.tracking = tracking;
        if (!session->applyText(draft))
            qFatal("text refused");
        QTest::qWait(100);
        return session->activeLayerID().value();
    };
    const QUuid wild = text(QStringLiteral("WILD"), QStringLiteral("Inter-Black"), 380, QPointF(70, 40), 0);
    text(QStringLiteral("OMAPHOTO · FIELD ISSUE"), QStringLiteral("Inter-SemiBold"), 34, QPointF(92, 468), 9);
    const QUuid wolf = import(QStringLiteral("Wolf.png"), QPointF(1000, 640));
    removeBackground();
    session->selectLayer(wild);
    session->selectTool(NavigationTool::move);
    settle();

    rec.begin(QStringLiteral("main"));
    rec.rect(QStringLiteral("canvas"), canvas());
    rec.rect(QStringLiteral("wolf"), layerRect(wolf));
    rec.rect(QStringLiteral("wildText"), layerRect(wild));
    rec.rect(QStringLiteral("layersPanel"), find(QStringLiteral("layersPanel")));
    rec.rect(QStringLiteral("blendDropdown"), find(QStringLiteral("blendMode")));
    rec.marker(QStringLiteral("poster"));
    rec.hold(60);

    // Layers: one event per beat.
    const auto event = [&](const QString &name, const std::function<void()> &act) {
        act();
        rec.marker(name);
        rec.hold(15);
    };
    event(QStringLiteral("layers.screen"), [&] { session->setLayerBlendMode(LayerBlendMode::screen); });
    event(QStringLiteral("layers.difference"), [&] { session->setLayerBlendMode(LayerBlendMode::difference); });
    event(QStringLiteral("layers.overlay"), [&] { session->setLayerBlendMode(LayerBlendMode::overlay); });
    event(QStringLiteral("layers.normal"), [&] { session->setLayerBlendMode(LayerBlendMode::normal); });
    event(QStringLiteral("layers.new"), [&] {
        session->selectLayer(wolf);
        session->addBlankLayer();
    });
    const QUuid paintLayer = session->activeLayerID().value();

    // Paint: a soft and a hard stroke — the brush tip is tracked for the camera.
    session->selectTool(NavigationTool::brush);
    const auto brush = [&](double r, double g, double b, double diameter, double hardness) {
        BrushSettings settings = session->brushSettings();
        settings.diameter = diameter;
        settings.hardness = hardness;
        settings.opacity = 0.95;
        settings.red = r;
        settings.green = g;
        settings.blue = b;
        session->setBrushSettings(settings);
    };
    const auto send = [&](QPointF view, Qt::MouseButtons buttons) {
        QMouseEvent event(QEvent::MouseMove, view, view, canvas()->mapToGlobal(view.toPoint()), Qt::NoButton, buttons, Qt::NoModifier);
        QApplication::sendEvent(canvas(), &event);
        rec.track(QStringLiteral("brush"), windowOf(view));
    };
    const auto stroke = [&](const QString &name, const std::function<QPointF(double)> &path, int frames) {
        const QPointF start = viewOf(path(0));
        rec.animate(10, [&](double t) { send(start + QPointF(-120 * (1 - t), 70 * (1 - t)), Qt::NoButton); });
        QTest::mousePress(canvas(), Qt::LeftButton, Qt::NoModifier, start.toPoint());
        rec.marker(name);
        double last = 0;
        rec.animate(frames, [&](double t) {
            for (int i = 1; i <= 6; ++i)
                send(viewOf(path(last + (t - last) * i / 6)), Qt::LeftButton);
            last = t;
        });
        QTest::mouseRelease(canvas(), Qt::LeftButton, Qt::NoModifier, viewOf(path(1)).toPoint());
        QTest::qWait(300);
        rec.hold(6);
    };
    rec.marker(QStringLiteral("paint.start"));
    brush(1.0, 0.42, 0.72, 90, 0.25);
    stroke(QStringLiteral("paint.soft"), [](double t) { return QPointF(170 + 1180 * t, 860 - 560 * std::sin(t * M_PI)); }, 42);
    brush(1.0, 0.82, 0.25, 40, 1.0);
    stroke(QStringLiteral("paint.hard"), [](double t) { return QPointF(250 + 1080 * t, 940 - 380 * std::sin(t * M_PI)); }, 36);
    rec.track(QStringLiteral("brush"), std::nullopt);
    rec.hold(8);
    rec.marker(QStringLiteral("paint.end"));

    // Clear the strokes as a visible action, so the adjust demo starts clean.
    session->selectTool(NavigationTool::move);
    rec.hold(15);
    event(QStringLiteral("paint.hide"), [&] { session->toggleLayerVisibility(paintLayer); });
    rec.hold(15);

    // Adjust: the lake's hue swung live; text and wolf stay put.
    session->selectLayer(lake);
    QTest::qWait(200);
    session->beginHueSaturation();
    QTest::qWait(300);
    auto *hue = find<QSlider>(QStringLiteral("hueSlider"));
    auto *saturation = find<QSlider>(QStringLiteral("saturationSlider"));
    if (!hue || !saturation)
        qFatal("no hue sliders");
    // The app centres the panel on the canvas, over the wolf; park it over the sky.
    hue->window()->move(window.mapToGlobal(QPoint(1310 - hue->window()->width(), 120)));
    QTest::qWait(100);
    rec.rect(QStringLiteral("hueDialog"), hue->window());
    const auto setHue = [&](double degrees) {
        hue->setValue(hue->minimum() + int(std::lround((degrees + 180) / 360 * (hue->maximum() - hue->minimum()))));
        rec.value(QStringLiteral("hue"), std::round(degrees));
    };
    const auto setSaturation = [&](double amount) {
        saturation->setValue(saturation->minimum() + int(std::lround((amount + 100) / 200 * (saturation->maximum() - saturation->minimum()))));
        rec.value(QStringLiteral("saturation"), std::round(amount));
    };
    setHue(0);
    setSaturation(0);
    rec.marker(QStringLiteral("adjust.open"));
    rec.hold(12);
    rec.marker(QStringLiteral("adjust.hue"));
    rec.animate(45, [&](double t) { setHue(180 * t); });
    rec.hold(8);
    rec.marker(QStringLiteral("adjust.back"));
    rec.animate(30, [&](double t) { setHue(180 - 259 * t); });
    rec.hold(8);
    rec.marker(QStringLiteral("adjust.saturation"));
    rec.animate(20, [&](double t) { setSaturation(24 * t); });
    rec.hold(40);
    rec.marker(QStringLiteral("adjust.end"));
    rec.finish();
    session->cancelHueSaturation();
    QTest::qWait(300);

    // themes: one still per theme, the poster clean.
    session->selectLayer(wild);
    rec.begin(QStringLiteral("themes"));
    const QStringList themes = qEnvironmentVariable("PROMO_THEMES").split(QLatin1Char(' '), Qt::SkipEmptyParts);
    for (const QString &name : themes) {
        theme = std::make_unique<OmarchyTheme>(assets + "/themes/" + name);
        QTest::qWait(250);
        rec.marker(name);
        rec.frame();
    }
    rec.finish();
    qInfo("promo: done");
    return 0;
}
